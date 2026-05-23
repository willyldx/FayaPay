import re

content = open('/opt/kadryza/internal/api/handlers/merchants.go').read()

# Add zap import if not there
if '"go.uber.org/zap"' not in content:
    print("zap already imported")

# Find BodyParser line and add logging
old_snippet = '''if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	// Basic validation.
	if req.Name == "" || req.Email == "" || req.Password == "" {'''

new_snippet = '''bodyBytes := c.Body()
	h.logger.Info("REGISTER_DEBUG",
		zap.String("body_raw", string(bodyBytes)),
		zap.Int("body_len", len(bodyBytes)),
		zap.String("content_type", c.Get("Content-Type")),
	)
	if err := c.BodyParser(&req); err != nil {
		h.logger.Error("BODYPARSER_ERROR", zap.Error(err), zap.String("body", string(bodyBytes)))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "INVALID_BODY",
		})
	}

	// Basic validation.
	if req.Name == "" || req.Email == "" || req.Password == "" {'''

if old_snippet in content:
    new_content = content.replace(old_snippet, new_snippet, 1)
    open('/opt/kadryza/internal/api/handlers/merchants.go', 'w').write(new_content)
    print("OK - patched successfully")
else:
    # Try to find approximately where it is
    idx = content.find('BodyParser')
    print(f"NOT FOUND. BodyParser at index {idx}")
    print(repr(content[idx-20:idx+200]))
