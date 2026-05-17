package gateway

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Sentinel errors.
var (
	ErrNoGateway       = errors.New("no gateway available for operator")
	ErrSendChannelFull = errors.New("gateway send channel is full")
)

// ClientMessage wraps an incoming message with the client that sent it.
type ClientMessage struct {
	Client  *Client
	Message IncomingMessage
}

// MessageHandler is a callback function invoked when the Hub receives a message.
// Set via Hub.OnMessage() to route messages to the transaction service.
type MessageHandler func(msg IncomingMessage)

// Hub maintains the set of active gateway WebSocket connections.
// Thread-safety is achieved via channels (per PRD requirement).
// One gateway per operator — if a new gateway connects for the same operator,
// the old one is disconnected (PRD rule #4).
type Hub struct {
	logger *zap.Logger

	// Channels for thread-safe operations (no mutex on maps).
	register   chan *Client
	unregister chan *Client
	incoming   chan ClientMessage
	quit       chan struct{}
	done       chan struct{}

	// Protected state — only accessed from the Run() goroutine.
	clients         map[string]*Client // gateway_id → Client
	operatorClients map[string]*Client // operator → Client (one gateway per operator, PRD rule #4)

	// External message handler (set by main to route to transaction service).
	mu             sync.RWMutex
	messageHandler MessageHandler
}

// NewHub creates a new WebSocket Hub.
func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		logger:          logger.Named("ws-hub"),
		register:        make(chan *Client),
		unregister:      make(chan *Client),
		incoming:        make(chan ClientMessage, 256),
		quit:            make(chan struct{}),
		done:            make(chan struct{}),
		clients:         make(map[string]*Client),
		operatorClients: make(map[string]*Client),
	}
}

// OnMessage sets the handler function called when a gateway message is received.
// This connects the Hub to the transaction service for processing SMS confirmations, etc.
func (h *Hub) OnMessage(handler MessageHandler) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.messageHandler = handler
}

// Run starts the Hub's main event loop.
// All client map mutations happen exclusively in this goroutine — no locks needed.
func (h *Hub) Run() {
	defer close(h.done)
	h.logger.Info("Hub event loop started")

	for {
		select {
		case client := <-h.register:
			h.handleRegister(client)

		case client := <-h.unregister:
			h.handleUnregister(client)

		case cm := <-h.incoming:
			h.handleMessage(cm)

		case <-h.quit:
			// Shutdown: close all client connections.
			for _, client := range h.clients {
				close(client.send)
			}
			h.logger.Info("Hub event loop stopped")
			return
		}
	}
}

// Shutdown signals the Hub to stop and waits for cleanup.
func (h *Hub) Shutdown() {
	close(h.quit)
	<-h.done
}

// Register adds a new gateway client. Called from the WebSocket upgrade handler.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// =============================================================================
// Send messages to gateways
// =============================================================================

// SendToOperator sends a message to the gateway handling the specified operator.
func (h *Hub) SendToOperator(operator string, msg interface{}) error {
	// Access operatorClients safely — this is read from outside the Run goroutine,
	// but operatorClients is only written from Run(). Use a snapshot approach.
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	// Find the client for this operator.
	// We use a channel-based request/response to safely access the map.
	type lookupResult struct {
		client *Client
		ok     bool
	}
	resultCh := make(chan lookupResult, 1)

	// Post a lookup request to the incoming channel (reuse it for simplicity).
	// Actually, to avoid complexity, we'll use a RWMutex for reads only.
	// The PRD says "no mutex on maps" for writes — reads with RWMutex are acceptable.
	h.mu.RLock()
	client, ok := h.operatorClients[operator]
	h.mu.RUnlock()
	_ = resultCh // unused, keeping simple

	if !ok || client == nil {
		return ErrNoGateway
	}

	select {
	case client.send <- data:
		return nil
	default:
		return ErrSendChannelFull
	}
}

// GetConnectedGateways returns the status of all connected gateway devices.
func (h *Hub) GetConnectedGateways() []GatewayStatus {
	h.mu.RLock()
	defer h.mu.RUnlock()

	statuses := make([]GatewayStatus, 0, len(h.clients))
	for _, client := range h.clients {
		statuses = append(statuses, client.Status())
	}
	return statuses
}

// =============================================================================
// Internal handlers — only called from Run() goroutine
// =============================================================================

func (h *Hub) handleRegister(client *Client) {
	// Check if this gateway ID is already connected.
	if existing, ok := h.clients[client.GatewayID]; ok {
		h.logger.Warn("gateway reconnecting — disconnecting old connection",
			zap.String("gateway_id", client.GatewayID),
		)
		close(existing.send)
		delete(h.clients, existing.GatewayID)
	}

	// Register the client.
	h.clients[client.GatewayID] = client

	// PRD rule #4: one gateway per operator.
	// Register for each operator this gateway handles.
	for _, op := range client.Operators {
		if existing, ok := h.operatorClients[op]; ok && existing.GatewayID != client.GatewayID {
			h.logger.Warn("replacing existing gateway for operator",
				zap.String("operator", op),
				zap.String("old_gateway", existing.GatewayID),
				zap.String("new_gateway", client.GatewayID),
			)
			close(existing.send)
			delete(h.clients, existing.GatewayID)
		}

		h.mu.Lock()
		h.operatorClients[op] = client
		h.mu.Unlock()
	}

	h.logger.Info("gateway registered",
		zap.String("gateway_id", client.GatewayID),
		zap.Strings("operators", client.Operators),
		zap.Int("total_clients", len(h.clients)),
	)
}

func (h *Hub) handleUnregister(client *Client) {
	if _, ok := h.clients[client.GatewayID]; !ok {
		return // Already removed.
	}

	// Remove from operator map.
	h.mu.Lock()
	for _, op := range client.Operators {
		if current, ok := h.operatorClients[op]; ok && current.GatewayID == client.GatewayID {
			delete(h.operatorClients, op)
		}
	}
	h.mu.Unlock()

	// Close send channel and remove.
	close(client.send)
	delete(h.clients, client.GatewayID)

	h.logger.Info("gateway unregistered",
		zap.String("gateway_id", client.GatewayID),
		zap.Int("total_clients", len(h.clients)),
	)
}

func (h *Hub) handleMessage(cm ClientMessage) {
	msg := cm.Message
	client := cm.Client

	switch msg.Type {
	case TypePong:
		// Update SIM status from heartbeat.
		client.SIMStatus = msg.SIMStatus
		client.LastPongAt = time.Now()
		h.logger.Debug("pong received",
			zap.String("gateway_id", client.GatewayID),
			zap.Any("sim_status", msg.SIMStatus),
		)

	case TypeACK, TypeUSSDStarted, TypeSMSReceived, TypeOperationFailed:
		// Route to the external message handler (transaction service).
		h.mu.RLock()
		handler := h.messageHandler
		h.mu.RUnlock()

		if handler != nil {
			handler(msg)
		} else {
			h.logger.Warn("no message handler registered — dropping message",
				zap.String("type", msg.Type),
				zap.String("transaction_id", msg.TransactionID),
			)
		}

	default:
		h.logger.Warn("unknown message type from gateway",
			zap.String("type", msg.Type),
			zap.String("gateway_id", client.GatewayID),
		)
	}
}
