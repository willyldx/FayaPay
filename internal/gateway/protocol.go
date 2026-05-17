package gateway

// =============================================================================
// WebSocket Protocol — message types exchanged between backend and gateway
// =============================================================================
// All messages are JSON with a "type" field for routing.

// Message type constants.
const (
	// Backend → Gateway (instructions)
	TypeInitiatePayment = "INITIATE_PAYMENT"
	TypePing            = "PING"

	// Gateway → Backend (reports)
	TypeACK             = "ACK"
	TypeUSSDStarted     = "USSD_STARTED"
	TypeSMSReceived     = "SMS_RECEIVED"
	TypeOperationFailed = "OPERATION_FAILED"
	TypePong            = "PONG"

	// Internal Hub events (not sent over wire)
	TypeRegister   = "REGISTER"
	TypeUnregister = "UNREGISTER"
)

// =============================================================================
// Backend → Gateway messages
// =============================================================================

// InitiatePaymentMessage instructs the gateway to start a USSD payment session.
type InitiatePaymentMessage struct {
	Type          string `json:"type"`
	TransactionID string `json:"transaction_id"`
	Amount        int64  `json:"amount"`
	PhoneNumber   string `json:"phone_number"`
	Operator      string `json:"operator"`
}

// PingMessage requests an immediate heartbeat from the gateway.
type PingMessage struct {
	Type string `json:"type"`
}

// =============================================================================
// Gateway → Backend messages
// =============================================================================

// IncomingMessage is the generic envelope for all messages from a gateway.
// The Type field is used to determine how to parse the rest.
type IncomingMessage struct {
	Type          string     `json:"type"`
	TransactionID string     `json:"transaction_id,omitempty"`
	GatewayID     string     `json:"gateway_id,omitempty"`
	Reason        string     `json:"reason,omitempty"`
	SMSRaw        string     `json:"sms_raw,omitempty"`
	Parsed        *SMSParsed `json:"parsed,omitempty"`
	SIMStatus     map[string]string `json:"sim_status,omitempty"`
}

// SMSParsed holds the structured data extracted from an operator SMS.
type SMSParsed struct {
	Amount    int64  `json:"amount"`
	Sender    string `json:"sender"`
	Reference string `json:"reference"`
	Success   bool   `json:"success"`
}

// =============================================================================
// Gateway status (for admin endpoint)
// =============================================================================

// GatewayStatus represents the current state of a connected gateway device.
type GatewayStatus struct {
	GatewayID  string            `json:"gateway_id"`
	Operators  []string          `json:"operators"`
	SIMStatus  map[string]string `json:"sim_status"`
	ConnectedAt string           `json:"connected_at"`
	LastPongAt  string           `json:"last_pong_at"`
}
