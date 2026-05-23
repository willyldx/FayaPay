package workers

import (
	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Task type constants — used to identify tasks in the queue.
const (
	TypeWebhookDeliver    = "webhook:deliver"
	TypeTransactionExpire = "transaction:expire"
)

// RegisterHandlers creates an Asynq ServeMux and registers all task handlers.
// Returns the mux to be used by the Asynq worker server.
func RegisterHandlers(
	pool *pgxpool.Pool,
	asynqClient *asynq.Client,
	webhookTimeoutSec int,
	logger *zap.Logger,
) *asynq.ServeMux {
	mux := asynq.NewServeMux()

	// Webhook delivery handler.
	webhookHandler := NewWebhookHandler(pool, webhookTimeoutSec, logger)
	mux.HandleFunc(TypeWebhookDeliver, webhookHandler.ProcessTask)

	// Transaction timeout handler (periodic scan).
	timeoutHandler := NewTimeoutHandler(pool, asynqClient, logger)
	mux.HandleFunc(TypeTransactionExpire, timeoutHandler.ProcessTask)

	logger.Info("Asynq task handlers registered",
		zap.String("webhook_handler", TypeWebhookDeliver),
		zap.String("timeout_handler", TypeTransactionExpire),
	)

	return mux
}

// NewScheduler creates an Asynq Scheduler that enqueues periodic tasks.
// Currently schedules: transaction timeout scan every 60 seconds.
func NewScheduler(redisOpt asynq.RedisClientOpt, logger *zap.Logger) *asynq.Scheduler {
	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{
		Logger: newAsynqZapLogger(logger),
	})

	// Schedule transaction timeout scan every 60 seconds.
	task := asynq.NewTask(TypeTransactionExpire, nil)
	entryID, err := scheduler.Register("@every 60s", task,
		asynq.Queue("timeouts"),
		asynq.MaxRetry(1), // Timeout scans are idempotent — 1 retry is enough.
	)
	if err != nil {
		logger.Fatal("failed to register periodic task",
			zap.String("task", TypeTransactionExpire),
			zap.Error(err),
		)
	}

	logger.Info("periodic task registered",
		zap.String("task", TypeTransactionExpire),
		zap.String("schedule", "@every 60s"),
		zap.String("entry_id", entryID),
	)

	return scheduler
}

// asynqZapLogger bridges Asynq's logger interface to Zap.
type asynqZapLogger struct {
	zap *zap.SugaredLogger
}

func newAsynqZapLogger(logger *zap.Logger) *asynqZapLogger {
	return &asynqZapLogger{zap: logger.Named("asynq").Sugar()}
}

func (l *asynqZapLogger) Debug(args ...interface{})                 { l.zap.Debug(args...) }
func (l *asynqZapLogger) Info(args ...interface{})                  { l.zap.Info(args...) }
func (l *asynqZapLogger) Warn(args ...interface{})                  { l.zap.Warn(args...) }
func (l *asynqZapLogger) Error(args ...interface{})                 { l.zap.Error(args...) }
func (l *asynqZapLogger) Fatal(args ...interface{})                 { l.zap.Fatal(args...) }
