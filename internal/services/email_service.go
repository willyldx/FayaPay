package services

import (
	"bytes"
	"fmt"
	"html/template"
	"net/smtp"
	"strings"

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

// SendVerificationEmail sends an email with a verification link to the merchant.
func (s *EmailService) SendVerificationEmail(email, token, name string) error {
	verifyURL := fmt.Sprintf("%s/verify-email?token=%s", s.config.AppURL, token)

	data := map[string]string{
		"Name":      name,
		"VerifyURL": verifyURL,
		"Year":      fmt.Sprintf("%d", 2026), // will be replaced by time.Now().Year() at runtime
	}

	body, err := renderTemplate(verificationEmailTpl, data)
	if err != nil {
		return fmt.Errorf("rendering verification email template: %w", err)
	}

	if err := s.sendMail(email, "Vérifiez votre adresse email — Kadryza", body); err != nil {
		return fmt.Errorf("sending verification email: %w", err)
	}

	s.logger.Info("verification email sent",
		zap.String("email", email),
	)
	return nil
}

// SendPasswordResetEmail sends an email with a password reset link.
func (s *EmailService) SendPasswordResetEmail(email, token, name string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", s.config.AppURL, token)

	data := map[string]string{
		"Name":     name,
		"ResetURL": resetURL,
		"Year":     fmt.Sprintf("%d", 2026),
	}

	body, err := renderTemplate(passwordResetEmailTpl, data)
	if err != nil {
		return fmt.Errorf("rendering password reset email template: %w", err)
	}

	if err := s.sendMail(email, "Réinitialisation de votre mot de passe — Kadryza", body); err != nil {
		return fmt.Errorf("sending password reset email: %w", err)
	}

	s.logger.Info("password reset email sent",
		zap.String("email", email),
	)
	return nil
}

// sendMail sends an email via SMTP with TLS on port 587.
func (s *EmailService) sendMail(to, subject, htmlBody string) error {
	from := s.config.SMTPFrom
	addr := fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort)

	// Build RFC 2822 message with MIME headers.
	var msg bytes.Buffer
	msg.WriteString(fmt.Sprintf("From: Kadryza <%s>\r\n", from))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", to))
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	auth := smtp.PlainAuth("", s.config.SMTPUser, s.config.SMTPPassword, s.config.SMTPHost)

	if err := smtp.SendMail(addr, auth, from, []string{to}, msg.Bytes()); err != nil {
		s.logger.Error("SMTP send failed",
			zap.String("to", to),
			zap.Error(err),
		)
		return fmt.Errorf("SMTP send: %w", err)
	}

	return nil
}

// renderTemplate renders an HTML template with the given data.
func renderTemplate(tplStr string, data map[string]string) (string, error) {
	tpl, err := template.New("email").Parse(tplStr)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// =============================================================================
// Email Templates — HTML inline avec branding Kadryza (#F97316 orange)
// =============================================================================

var verificationEmailTpl = strings.TrimSpace(`
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background-color:#F97316;padding:32px 40px;text-align:center;">
        <h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:700;letter-spacing:-0.5px;">⚡ Kadryza</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Bienvenue, {{.Name}} 👋</h2>
        <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px;">
          Merci de vous être inscrit sur <strong>Kadryza</strong>. Pour activer votre compte et commencer à intégrer nos services de paiement, veuillez vérifier votre adresse email.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="{{.VerifyURL}}" style="display:inline-block;background-color:#F97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                Vérifier mon email
              </a>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:24px 0 0;">
          Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte, ignorez simplement cet email.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;">
        <p style="color:#cbd5e1;font-size:12px;text-align:center;margin:0;">
          © {{.Year}} Kadryza — Infrastructure de paiement CEMAC
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`)

var passwordResetEmailTpl = strings.TrimSpace(`
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background-color:#F97316;padding:32px 40px;text-align:center;">
        <h1 style="color:#ffffff;font-size:28px;margin:0;font-weight:700;letter-spacing:-0.5px;">⚡ Kadryza</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px;">
        <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Réinitialisation du mot de passe</h2>
        <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 8px;">
          Bonjour <strong>{{.Name}}</strong>,
        </p>
        <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px;">
          Nous avons reçu une demande de réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <a href="{{.ResetURL}}" style="display:inline-block;background-color:#F97316;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;letter-spacing:0.3px;">
                Réinitialiser mon mot de passe
              </a>
            </td>
          </tr>
        </table>
        <p style="color:#94a3b8;font-size:14px;line-height:1.5;margin:24px 0 0;">
          Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez simplement cet email — votre mot de passe ne sera pas modifié.
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px;">
        <p style="color:#cbd5e1;font-size:12px;text-align:center;margin:0;">
          © {{.Year}} Kadryza — Infrastructure de paiement CEMAC
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`)
