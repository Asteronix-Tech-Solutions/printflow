package events

import (
	"sync"
)

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data,omitempty"`
}

type Broadcaster struct {
	clients    map[chan Event]bool
	register   chan chan Event
	unregister chan chan Event
	broadcast  chan Event
	mu         sync.RWMutex
}

func NewBroadcaster() *Broadcaster {
	b := &Broadcaster{
		clients:    make(map[chan Event]bool),
		register:   make(chan chan Event),
		unregister: make(chan chan Event),
		broadcast:  make(chan Event, 200),
	}
	go b.run()
	return b
}

func (b *Broadcaster) run() {
	for {
		select {
		case ch := <-b.register:
			b.mu.Lock()
			b.clients[ch] = true
			b.mu.Unlock()
		case ch := <-b.unregister:
			b.mu.Lock()
			if _, ok := b.clients[ch]; ok {
				delete(b.clients, ch)
				close(ch)
			}
			b.mu.Unlock()
		case event := <-b.broadcast:
			b.mu.RLock()
			for ch := range b.clients {
				select {
				case ch <- event:
				default:
					// Drop event for slow client if channel buffer is full to prevent blocking
				}
			}
			b.mu.RUnlock()
		}
	}
}

func (b *Broadcaster) Subscribe() chan Event {
	ch := make(chan Event, 50)
	b.register <- ch
	return ch
}

func (b *Broadcaster) Unsubscribe(ch chan Event) {
	b.unregister <- ch
}

func (b *Broadcaster) Publish(event Event) {
	if b == nil {
		return
	}
	select {
	case b.broadcast <- event:
	default:
		// Drop if buffer full
	}
}
