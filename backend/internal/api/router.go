package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func NewRouter(h *Handler) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/webhook", h.HandleWebhook)

		r.Get("/templates", h.ListTemplates)
		r.Post("/templates", h.SaveTemplate)
		r.Get("/templates/{id}", h.GetTemplate)
		r.Delete("/templates/{id}", h.DeleteTemplate)
		r.Post("/formatter/preview", h.PreviewTemplate)
		r.Post("/formatter/preview-pdf", h.PreviewTemplatePDF)

		r.Get("/jobs", h.ListJobs)
		r.Post("/jobs", h.ManualQueueJob)
		r.Get("/jobs/{id}", h.GetJob)
		r.Get("/jobs/{id}/pdf", h.GetJobPDF)
		r.Post("/jobs/{id}/retry", h.RetryJob)
		r.Post("/jobs/{id}/cancel", h.CancelJob)
		r.Post("/jobs/{id}/reformat", h.ReformatJob)

		r.Get("/printer/status", h.GetPrinterStatus)
		r.Post("/printer/config", h.UpdatePrinterConfig)

		r.Get("/logs", h.ListLogs)
		r.Get("/health", h.GetHealth)
	})

	return r
}
