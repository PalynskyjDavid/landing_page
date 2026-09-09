package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// ServeUntilCancelled stops accepting connections, then lets in-flight requests
// finish. A bounded deadline prevents a stuck request from blocking container stop.
func ServeUntilCancelled(ctx context.Context, server *http.Server, listener net.Listener, timeout time.Duration) error {
	defer func() { _ = server.Close() }()
	finished := make(chan error, 1)
	go func() { finished <- server.Serve(listener) }()
	select {
	case err := <-finished:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("serve HTTP: %w", err)
		}
		return nil
	case <-ctx.Done():
		// Do not inherit the cancelled signal context: requests get time to drain.
		shutdownContext, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			return fmt.Errorf("shutdown HTTP: %w", err)
		}
		<-finished
		return nil
	}
}
