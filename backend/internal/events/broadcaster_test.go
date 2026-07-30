package events

import (
	"testing"
	"time"
)

func TestBroadcasterPublishSubscribe(t *testing.T) {
	b := NewBroadcaster()
	ch := b.Subscribe()
	defer b.Unsubscribe(ch)

	testEv := Event{
		Type: "job_updated",
		Data: map[string]string{"id": "job-123", "status": "completed"},
	}

	b.Publish(testEv)

	select {
	case received := <-ch:
		if received.Type != "job_updated" {
			t.Errorf("expected type 'job_updated', got '%s'", received.Type)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timed out waiting for broadcasted event")
	}
}
