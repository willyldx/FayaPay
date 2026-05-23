package gateway

import (
	"encoding/json"
	"time"

	"github.com/fasthttp/websocket"
	"go.uber.org/zap"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	// PRD rule #5: 60 seconds before marking disconnected.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = 30 * time.Second

	// Maximum message size allowed from peer (64KB).
	maxMessageSize = 64 * 1024
)

// Client represents a single connected gateway device.
type Client struct {
	GatewayID   string
	Operators   []string          // Operators this gateway can handle (e.g. ["AIRTEL", "MOOV"])
	SIMStatus   map[string]string // Operator → status (ACTIVE/INACTIVE)
	ConnectedAt time.Time
	LastPongAt  time.Time

	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte // Buffered channel of outbound messages.
	logger *zap.Logger
}

// NewClient creates a new WebSocket client for a gateway device.
func NewClient(hub *Hub, conn *websocket.Conn, gatewayID string, operators []string, logger *zap.Logger) *Client {
	return &Client{
		GatewayID:   gatewayID,
		Operators:   operators,
		SIMStatus:   make(map[string]string),
		ConnectedAt: time.Now(),
		LastPongAt:  time.Now(),
		hub:         hub,
		conn:        conn,
		send:        make(chan []byte, 256),
		logger:      logger.Named("ws-client").With(zap.String("gateway_id", gatewayID)),
	}
}

// ReadPump pumps messages from the WebSocket connection to the Hub.
// Runs in its own goroutine. The connection is closed when this returns.
func (c *Client) ReadPump() {
	defer func() {
		// FIX L7: Timeout prevents goroutine leak if Hub.Run() already exited.
		select {
		case c.hub.unregister <- c:
		case <-time.After(5 * time.Second):
			c.logger.Warn("timeout sending unregister — Hub may have stopped")
		}
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait)) //nolint:errcheck
	c.conn.SetPongHandler(func(string) error {
		c.LastPongAt = time.Now()
		c.conn.SetReadDeadline(time.Now().Add(pongWait)) //nolint:errcheck
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.logger.Warn("unexpected WebSocket close", zap.Error(err))
			}
			break
		}

		// Parse the incoming message.
		var msg IncomingMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			c.logger.Warn("invalid JSON from gateway", zap.Error(err))
			continue
		}

		// Tag message with gateway ID.
		msg.GatewayID = c.GatewayID

		// Route to hub for processing.
		c.hub.incoming <- ClientMessage{
			Client:  c,
			Message: msg,
		}
	}
}

// WritePump pumps messages from the Hub to the WebSocket connection.
// Runs in its own goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait)) //nolint:errcheck

			if !ok {
				// Hub closed the channel — send a close frame.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{}) //nolint:errcheck
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message) //nolint:errcheck

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			// Send periodic ping.
			c.conn.SetWriteDeadline(time.Now().Add(writeWait)) //nolint:errcheck
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendMessage sends a JSON message to the gateway via the write channel.
func (c *Client) SendMessage(msg interface{}) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case c.send <- data:
		return nil
	default:
		// Channel full — gateway is too slow.
		c.logger.Warn("send channel full, dropping message")
		return ErrSendChannelFull
	}
}

// Status returns the current status of this gateway client.
func (c *Client) Status() GatewayStatus {
	return GatewayStatus{
		GatewayID:   c.GatewayID,
		Operators:   c.Operators,
		SIMStatus:   c.SIMStatus,
		ConnectedAt: c.ConnectedAt.Format(time.RFC3339),
		LastPongAt:  c.LastPongAt.Format(time.RFC3339),
	}
}
