package api

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"pintflow/backend/internal/config"
)

// SecurityHeaders returns a middleware that sets standard OWASP security response headers.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

// MaxBodySize returns a middleware that caps request body sizes to maxMB megabytes.
func MaxBodySize(maxMB int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if maxMB > 0 && r.Body != nil {
				maxBytes := maxMB * 1024 * 1024
				r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAPIKey returns a middleware enforcing X-API-Key or Authorization: Bearer <key> auth when cfg.APIKey is configured.
func RequireAPIKey(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If APIKey is not configured on server, allow request (for development backwards-compatibility)
			if cfg.APIKey == "" {
				next.ServeHTTP(w, r)
				return
			}

			apiKey := r.Header.Get("X-API-Key")
			if apiKey == "" {
				authHeader := r.Header.Get("Authorization")
				if strings.HasPrefix(authHeader, "Bearer ") {
					apiKey = strings.TrimPrefix(authHeader, "Bearer ")
				}
			}
			if apiKey == "" || subtle.ConstantTimeCompare([]byte(apiKey), []byte(cfg.APIKey)) != 1 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"error":"unauthorized: invalid or missing API key"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimiter returns an in-memory token bucket rate limiter middleware per client IP.
type rateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientBucket
	rps     float64
	burst   int
	cleanup time.Time
}

type clientBucket struct {
	tokens     float64
	lastUpdate time.Time
}

func RateLimiter(rps float64, burst int) func(http.Handler) http.Handler {
	rl := &rateLimiter{
		clients: make(map[string]*clientBucket),
		rps:     rps,
		burst:   burst,
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if rps <= 0 {
				next.ServeHTTP(w, r)
				return
			}

			ip := getClientIP(r)

			rl.mu.Lock()
			now := time.Now()

			// Periodically clean up old entries (every 10 mins)
			if now.Sub(rl.cleanup) > 10*time.Minute {
				for k, v := range rl.clients {
					if now.Sub(v.lastUpdate) > 10*time.Minute {
						delete(rl.clients, k)
					}
				}
				rl.cleanup = now
			}

			b, exists := rl.clients[ip]
			if !exists {
				b = &clientBucket{
					tokens:     float64(burst),
					lastUpdate: now,
				}
				rl.clients[ip] = b
			}

			// Add tokens based on elapsed time
			elapsed := now.Sub(b.lastUpdate).Seconds()
			b.tokens += elapsed * rps
			if b.tokens > float64(burst) {
				b.tokens = float64(burst)
			}
			b.lastUpdate = now

			if b.tokens < 1.0 {
				rl.mu.Unlock()
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"too many requests, rate limit exceeded"}`))
				return
			}

			b.tokens -= 1.0
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
