package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/palyndav/my-backend/internal/reliabilitylab"
)

func main() {
	assets := flag.String("assets", "../frontend/dist", "built frontend directory")
	state := flag.String("state", "../.lab/controller.json", "local durable limits and recovery state")
	flag.Parse()
	if err := run(*assets, *state); err != nil {
		log.Fatal(err)
	}
}

func run(assets, state string) error {
	// Acquire the fixed listener BEFORE reading state or touching Docker. A second
	// controller cannot create a second in-memory budget for this shared stack.
	listener, err := net.Listen("tcp4", reliabilitylab.Address)
	if err != nil {
		return err
	}
	defer func() { _ = listener.Close() }()
	startup, cancelStartup := context.WithTimeout(context.Background(), 45*time.Second)
	manager, err := reliabilitylab.NewManager(startup, reliabilitylab.Docker{}, reliabilitylab.FileStore{Path: state}, time.Now)
	cancelStartup()
	if err != nil {
		return err
	}
	health := reliabilitylab.NewHealthMonitor()
	handler, err := reliabilitylab.NewHandler(manager, health, assets)
	if err != nil {
		return err
	}
	server := &http.Server{
		Handler: handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 35 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 * 1024,
	}
	signals, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	healthDone := make(chan struct{})
	go func() {
		defer close(healthDone)
		health.Run(signals)
	}()
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-signals.Done():
				return
			case <-ticker.C:
				ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
				manager.Tick(ctx)
				cancel()
			}
		}
	}()
	serverError := make(chan error, 1)
	go func() { serverError <- server.Serve(listener) }()
	log.Printf("Isolated container lab: %s/statistics?view=reliability (local only; production is not controlled)", reliabilitylab.Origin)
	select {
	case err = <-serverError:
		stop()
	case <-signals.Done():
	}
	shutdown, cancelShutdown := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancelShutdown()
	_ = server.Shutdown(shutdown)
	<-done
	<-healthDone
	manager.RestoreOnShutdown(shutdown)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}
