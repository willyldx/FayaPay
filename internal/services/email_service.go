package services

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"
	"time"

	"github.com/kadryza/kadryza-backend/internal/config"
	"go.uber.org/zap"
)

// EmailService handles sending transactional emails via SMTP.
type EmailService struct {
	config *config.Config
	logger *zap.Logger
}

// NewEmailService creates a new EmailService.
func NewEmailService(cfg *config.Config, logger *zap.Logger) *EmailService {
	return &EmailService{
		config: cfg,
		logger: logger.Named("email-svc"),
	}
}

// =============================================================================
// Content model + rendering
// =============================================================================

// emailContent is the structured content rendered into the shared base layout.
type emailContent struct {
	Subject  string
	Preview  string          // preheader text (hidden, shown in inbox preview)
	Heading  string          // escaped (plain text)
	Body     []template.HTML // trusted HTML paragraphs (authored here)
	CTAText  string
	CTAURL   string
	Footnote template.HTML // small trusted note under the CTA
	Year     int
}

// sendContent renders the content into the base layout and sends it.
func (s *EmailService) sendContent(to string, c emailContent) error {
	c.Year = time.Now().Year()
	var buf bytes.Buffer
	if err := baseEmailTpl.Execute(&buf, c); err != nil {
		return fmt.Errorf("rendering email template: %w", err)
	}
	if err := s.sendMail(to, c.Subject, buf.String()); err != nil {
		return err
	}
	s.logger.Info("email sent", zap.String("to", to), zap.String("subject", c.Subject))
	return nil
}

// para escapes a user value and wraps it as trusted body HTML.
func para(format string, args ...string) template.HTML {
	escaped := make([]any, len(args))
	for i, a := range args {
		escaped[i] = template.HTMLEscapeString(a)
	}
	return template.HTML(fmt.Sprintf(format, escaped...))
}

func formatXAF(amount int64) string {
	s := fmt.Sprintf("%d", amount)
	// Insert thin spaces as thousands separators.
	n := len(s)
	if n <= 3 {
		return s + " XAF"
	}
	var b strings.Builder
	pre := n % 3
	if pre > 0 {
		b.WriteString(s[:pre])
		if n > pre {
			b.WriteString(" ")
		}
	}
	for i := pre; i < n; i += 3 {
		b.WriteString(s[i : i+3])
		if i+3 < n {
			b.WriteString(" ")
		}
	}
	return b.String() + " XAF"
}

// =============================================================================
// Account lifecycle
// =============================================================================

// SendVerificationEmail — confirm the email address (link-based).
func (s *EmailService) SendVerificationEmail(email, token, name string) error {
	url := fmt.Sprintf("%s/verify/%s", s.config.AppURL, token)
	return s.sendContent(email, emailContent{
		Subject: "Vérifiez votre adresse email — Kadryza",
		Preview: "Confirmez votre adresse pour activer votre compte Kadryza.",
		Heading: fmt.Sprintf("Bienvenue, %s 👋", name),
		Body: []template.HTML{
			"Merci de vous être inscrit sur <strong>Kadryza</strong>. Pour activer votre compte et commencer à encaisser, veuillez confirmer votre adresse email.",
		},
		CTAText:  "Vérifier mon email",
		CTAURL:   url,
		Footnote: "Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez simplement cet email.",
	})
}

// SendWelcomeEmail — onboarding instructions, sent after the email is verified.
func (s *EmailService) SendWelcomeEmail(email, name string) error {
	dashboard := strings.TrimRight(s.config.AppURL, "/")
	return s.sendContent(email, emailContent{
		Subject: "Votre compte Kadryza est prêt 🚀",
		Preview: "Voici comment démarrer avec Kadryza en 3 étapes.",
		Heading: fmt.Sprintf("Bienvenue à bord, %s !", name),
		Body: []template.HTML{
			"Votre adresse email est vérifiée et votre compte <strong>Kadryza</strong> est actif. Voici comment commencer :",
			"<strong>1.</strong> Créez une <strong>clé API</strong> depuis l'onglet « Clés API ».<br>" +
				"<strong>2.</strong> Configurez un <strong>webhook</strong> pour recevoir les notifications de paiement.<br>" +
				"<strong>3.</strong> Ou créez un <strong>lien de paiement</strong> pour encaisser sans code.",
			"Notre documentation vous guide pour intégrer Airtel Money et Moov Money en quelques minutes.",
		},
		CTAText:  "Accéder à mon dashboard",
		CTAURL:   dashboard,
		Footnote: "Besoin d'aide ? Répondez à cet email ou contactez support@kadryza.app.",
	})
}

// SendPasswordResetEmail — reset link.
func (s *EmailService) SendPasswordResetEmail(email, token, name string) error {
	url := fmt.Sprintf("%s/reset-password/%s", s.config.AppURL, token)
	return s.sendContent(email, emailContent{
		Subject: "Réinitialisation de votre mot de passe — Kadryza",
		Preview: "Définissez un nouveau mot de passe pour votre compte Kadryza.",
		Heading: "Réinitialisation du mot de passe",
		Body: []template.HTML{
			para("Bonjour <strong>%s</strong>,", name),
			"Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.",
		},
		CTAText:  "Réinitialiser mon mot de passe",
		CTAURL:   url,
		Footnote: "Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.",
	})
}

// =============================================================================
// Security alerts
// =============================================================================

// SendPasswordChangedEmail — security alert after a password change.
func (s *EmailService) SendPasswordChangedEmail(email, name string) error {
	when := time.Now().UTC().Format("02/01/2006 15:04 UTC")
	return s.sendContent(email, emailContent{
		Subject: "Votre mot de passe a été modifié — Kadryza",
		Preview: "Confirmation de sécurité : votre mot de passe a changé.",
		Heading: "Mot de passe modifié",
		Body: []template.HTML{
			para("Bonjour <strong>%s</strong>,", name),
			para("Le mot de passe de votre compte Kadryza a été modifié le <strong>%s</strong>.", when),
			"Si vous êtes à l'origine de ce changement, aucune action n'est nécessaire.",
		},
		Footnote: "Si vous n'avez pas effectué ce changement, contactez immédiatement support@kadryza.app pour sécuriser votre compte.",
	})
}

// SendAPIKeyCreatedEmail — security alert when a new API key is generated.
func (s *EmailService) SendAPIKeyCreatedEmail(email, name, prefix string) error {
	when := time.Now().UTC().Format("02/01/2006 15:04 UTC")
	return s.sendContent(email, emailContent{
		Subject: "Nouvelle clé API créée — Kadryza",
		Preview: "Une nouvelle clé API a été générée sur votre compte.",
		Heading: "Nouvelle clé API créée",
		Body: []template.HTML{
			para("Bonjour <strong>%s</strong>,", name),
			para("Une nouvelle clé API (préfixe <strong>%s…</strong>) a été générée sur votre compte le <strong>%s</strong>.", prefix, when),
			"Conservez cette clé en lieu sûr — elle donne un accès complet à votre compte via l'API.",
		},
		Footnote: "Si vous n'êtes pas à l'origine de cette action, révoquez la clé depuis votre dashboard et contactez support@kadryza.app.",
	})
}

// SendAPIKeyRevokedEmail — security alert when an API key is revoked.
func (s *EmailService) SendAPIKeyRevokedEmail(email, name string) error {
	when := time.Now().UTC().Format("02/01/2006 15:04 UTC")
	return s.sendContent(email, emailContent{
		Subject: "Clé API révoquée — Kadryza",
		Preview: "Une clé API de votre compte a été révoquée.",
		Heading: "Clé API révoquée",
		Body: []template.HTML{
			para("Bonjour <strong>%s</strong>,", name),
			para("Une clé API de votre compte a été révoquée le <strong>%s</strong>. Toute requête utilisant cette clé sera désormais rejetée.", when),
		},
		Footnote: "Si vous n'êtes pas à l'origine de cette action, contactez immédiatement support@kadryza.app.",
	})
}

// =============================================================================
// Business
// =============================================================================

// SendPaymentReceivedEmail — notify the merchant of a successful payment.
func (s *EmailService) SendPaymentReceivedEmail(email, name, reference, phone string, amount int64) error {
	return s.sendContent(email, emailContent{
		Subject: fmt.Sprintf("Paiement reçu : %s — Kadryza", formatXAF(amount)),
		Preview: fmt.Sprintf("Vous avez reçu %s.", formatXAF(amount)),
		Heading: fmt.Sprintf("Paiement reçu : %s", formatXAF(amount)),
		Body: []template.HTML{
			para("Bonjour <strong>%s</strong>,", name),
			para("Un paiement de <strong>%s</strong> a été confirmé avec succès.", formatXAF(amount)),
			para("Référence : <strong>%s</strong><br>Payeur : <strong>%s</strong>", reference, phone),
		},
		CTAText:  "Voir la transaction",
		CTAURL:   strings.TrimRight(s.config.AppURL, "/") + "/transactions",
		Footnote: "Ceci est une notification automatique. Retrouvez le détail dans votre dashboard.",
	})
}

// =============================================================================
// SMTP transport
// =============================================================================

// sendMail sends an HTML email via SMTP.
//   - Port 465  → implicit TLS (SMTPS).
//   - Port 587/25 → STARTTLS (handled by smtp.SendMail).
// If SMTP is not configured (empty host), it logs a warning and skips sending
// so that registration / password-reset flows don't fail on a missing config.
func (s *EmailService) sendMail(to, subject, htmlBody string) error {
	host := strings.TrimSpace(s.config.SMTPHost)
	if host == "" {
		s.logger.Warn("SMTP not configured (SMTP_HOST empty) — email not sent",
			zap.String("to", to),
			zap.String("subject", subject),
		)
		return nil
	}

	from := s.config.SMTPFrom
	port := s.config.SMTPPort
	if port == 0 {
		port = 587
	}
	addr := fmt.Sprintf("%s:%d", host, port)

	// Build RFC 2822 message with MIME headers.
	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: Kadryza <%s>\r\n", from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	auth := smtp.PlainAuth("", s.config.SMTPUser, s.config.SMTPPassword, host)

	var err error
	if port == 465 {
		err = s.sendMailImplicitTLS(addr, host, auth, from, to, msg.Bytes())
	} else {
		err = smtp.SendMail(addr, auth, from, []string{to}, msg.Bytes())
	}
	if err != nil {
		s.logger.Error("SMTP send failed", zap.String("to", to), zap.Error(err))
		return fmt.Errorf("SMTP send: %w", err)
	}
	return nil
}

// sendMailImplicitTLS sends a message over an implicit-TLS connection (port 465).
func (s *EmailService) sendMailImplicitTLS(addr, host string, auth smtp.Auth, from, to string, raw []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host})
	if err != nil {
		return fmt.Errorf("TLS dial: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("SMTP client: %w", err)
	}
	defer c.Close()

	if err := c.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("MAIL FROM: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("RCPT TO: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("DATA: %w", err)
	}
	if _, err := w.Write(raw); err != nil {
		return fmt.Errorf("write body: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close body: %w", err)
	}
	return c.Quit()
}

// =============================================================================
// Shared base layout — branded Kadryza shell (#F97316)
// =============================================================================

var baseEmailTpl = template.Must(template.New("email").Parse(strings.TrimSpace(`
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">{{.Preview}}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background-color:#F97316;padding:32px 40px;text-align:center;">
        <h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:700;letter-spacing:-0.5px;">⚡ Kadryza</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">{{.Heading}}</h2>
        {{range .Body}}<p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 16px;">{{.}}</p>{{end}}
        {{if .CTAURL}}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">
          <tr><td align="center">
            <a href="{{.CTAURL}}" style="display:inline-block;background-color:#F97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">{{.CTAText}}</a>
          </td></tr>
        </table>
        {{end}}
        {{if .Footnote}}<p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:24px 0 0;">{{.Footnote}}</p>{{end}}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;">
        <p style="color:#cbd5e1;font-size:12px;text-align:center;margin:0;">© {{.Year}} Kadryza — Infrastructure de paiement CEMAC</p>
      </td>
    </tr>
  </table>
</body>
</html>
`)))
