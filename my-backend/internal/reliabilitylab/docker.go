package reliabilitylab

import (
	"context"
	"encoding/json"
	"errors"
	"os/exec"
	"strings"
	"time"
)

const Project = "landing-page-lab"
const DatabaseURL = "postgresql://lab_user:lab_password@db:5432/reaction_lab?sslmode=disable"

type Docker struct{}

type container struct {
	ID     string `json:"Id"`
	Config struct {
		Labels map[string]string
		Env    []string
	}
	State struct {
		Running bool
		Health  struct{ Status string }
	}
	HostConfig struct {
		Privileged  bool
		NetworkMode string
	}
	Mounts          []struct{ Type, Name string }
	NetworkSettings struct{ Networks map[string]json.RawMessage }
}

func dockerOutput(ctx context.Context, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	data, err := exec.CommandContext(ctx, "docker", args...).Output()
	if err != nil {
		// Do not return container environment, daemon errors or host paths to HTTP clients.
		return nil, errors.New("isolated lab Docker operation failed")
	}
	if len(data) > 1024*1024 {
		return nil, errors.New("unexpected Docker response size")
	}
	return data, nil
}

func ownedContainer(data []byte, service Service) (container, error) {
	var values []container
	if !validService(service) || json.Unmarshal(data, &values) != nil || len(values) != 1 {
		return container{}, errors.New("invalid lab container")
	}
	c := values[0]
	labels := c.Config.Labels
	if c.ID == "" || strings.HasPrefix(c.ID, "-") ||
		labels["com.docker.compose.project"] != Project ||
		labels["com.docker.compose.service"] != string(service) ||
		labels["landing-page.reliability-lab"] != "true" ||
		c.HostConfig.Privileged || len(c.NetworkSettings.Networks) != 1 {
		return container{}, errors.New("refusing non-lab container")
	}
	if _, ok := c.NetworkSettings.Networks[Project+"_default"]; !ok {
		return container{}, errors.New("refusing non-lab network")
	}
	env := func(expected string) bool {
		for _, value := range c.Config.Env {
			if value == expected {
				return true
			}
		}
		return false
	}
	if service == API && !env("DATABASE_URL="+DatabaseURL) {
		return container{}, errors.New("refusing API targeting another database")
	}
	if service == DB {
		if !env("POSTGRES_DB=reaction_lab") || !env("POSTGRES_USER=lab_user") ||
			len(c.Mounts) != 1 || c.Mounts[0].Type != "volume" || c.Mounts[0].Name != Project+"_data" {
			return container{}, errors.New("refusing non-lab database or volume")
		}
	}
	return c, nil
}

func (d Docker) inspect(ctx context.Context, service Service) (container, error) {
	if !validService(service) {
		return container{}, errors.New("unknown lab service")
	}
	// Names are fixed internally. The HTTP API never accepts IDs, names or shell commands.
	data, err := dockerOutput(ctx, "container", "inspect", Project+"-"+string(service)+"-1")
	if err != nil {
		return container{}, err
	}
	return ownedContainer(data, service)
}

func (d Docker) Inspect(ctx context.Context, service Service) (ServiceStatus, error) {
	c, err := d.inspect(ctx, service)
	if err != nil {
		return ServiceStatus{}, err
	}
	return ServiceStatus{Running: c.State.Running, Healthy: c.State.Running && c.State.Health.Status == "healthy"}, nil
}

func (d Docker) Stop(ctx context.Context, service Service) error {
	c, err := d.inspect(ctx, service)
	if err != nil {
		return err
	}
	if !c.State.Running {
		return nil
	}
	_, err = dockerOutput(ctx, "container", "stop", "--timeout", "12", c.ID)
	return err
}

func (d Docker) Start(ctx context.Context, service Service) error {
	c, err := d.inspect(ctx, service)
	if err != nil {
		return err
	}
	if c.State.Running {
		return nil
	}
	_, err = dockerOutput(ctx, "container", "start", c.ID)
	return err
}
