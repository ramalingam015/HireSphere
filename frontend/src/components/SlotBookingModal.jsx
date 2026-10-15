import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { 
  Calendar, Clock, Video, CheckCircle, AlertTriangle, 
  X, RefreshCw, XCircle, ExternalLink 
} from "lucide-react";

export const SlotBookingModal = ({ application, onClose, onUpdated }) => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const bookedSlot = application.booked_slot || slots.find(s => s.booked_by_application_id === application.id);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/interviews/slots/job/${application.job_id}`);
      setSlots(data);
    } catch (err) {
      setErrorMsg(err.message || "Failed to load interview slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [application.id]);

  const handleBookSlot = async (slotId) => {
    try {
      setActionLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      await apiRequest("/api/interviews/book", {
        method: "POST",
        body: JSON.stringify({
          application_id: application.id,
          slot_id: slotId
        })
      });

      setSuccessMsg("Interview slot successfully booked!");
      await fetchSlots();
      if (onUpdated) onUpdated();
    } catch (err) {
      setErrorMsg(err.message || "Failed to book slot");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeSlot = async (newSlotId) => {
    try {
      setActionLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      await apiRequest("/api/interviews/change-time", {
        method: "POST",
        body: JSON.stringify({
          application_id: application.id,
          new_slot_id: newSlotId
        })
      });

      setSuccessMsg("Interview time atomically rescheduled!");
      await fetchSlots();
      if (onUpdated) onUpdated();
    } catch (err) {
      setErrorMsg(err.message || "Failed to reschedule slot");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseInterview = async () => {
    if (!window.confirm("Are you sure you want to decline this interview? This will release your booked slot and move your application to Candidate Declined (FR-REC-07).")) {
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg("");

      await apiRequest(`/api/interviews/close/${application.id}`, {
        method: "POST"
      });

      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Failed to close interview");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: "600px" }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Interview Slot Selection</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {application.job?.title} @ {application.job?.company}
            </p>
          </div>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {errorMsg && (
          <div style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "0.75rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.85rem"
          }}>
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: "#d1fae5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
            padding: "0.75rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.85rem"
          }}>
            {successMsg}
          </div>
        )}

        {/* Current Booked Slot Banner */}
        {bookedSlot && (
          <div style={{
            background: "#e0e7ff",
            border: "1px solid #c7d2fe",
            borderRadius: "10px",
            padding: "1rem",
            marginBottom: "1.25rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 700, color: "#3730a3", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <CheckCircle size={16} /> Currently Booked Slot
              </span>
              <span className="status-pill status-interview">Confirmed</span>
            </div>
            <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1e1b4b" }}>
              📅 {formatDateTime(bookedSlot.start_time)} – {new Date(bookedSlot.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {bookedSlot.meeting_link && (
              <div style={{ marginTop: "0.6rem" }}>
                <a 
                  href={bookedSlot.meeting_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: "inline-flex", textDecoration: "none" }}
                >
                  <Video size={14} /> Join Interview Meeting Link <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Slots List */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-main)" }}>
            Available Interview Times:
          </h4>

          {loading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Loading interview slots...</p>
          ) : slots.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", background: "#f8fafc", borderRadius: "8px", border: "1px dashed var(--border)" }}>
              <Clock size={28} style={{ color: "var(--text-muted)", margin: "0 auto 0.5rem" }} />
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                The recruiter has not posted interview time slots for this role yet. Please check back shortly or reach out via direct message.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "280px", overflowY: "auto" }}>
              {slots.map((s) => {
                const isThisBooked = s.id === bookedSlot?.id;
                const isClaimedByOther = s.is_booked && !isThisBooked;
                const deadlinePassed = new Date() > new Date(s.selection_deadline);

                return (
                  <div 
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.85rem 1rem",
                      borderRadius: "8px",
                      border: isThisBooked ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: isThisBooked ? "#eef2ff" : isClaimedByOther ? "#f1f5f9" : "#ffffff",
                      opacity: isClaimedByOther || deadlinePassed ? 0.6 : 1
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                        {formatDateTime(s.start_time)} – {new Date(s.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                        Select before: {formatDateTime(s.selection_deadline)}
                      </div>
                    </div>

                    <div>
                      {isThisBooked ? (
                        <span className="skill-tag skill-matched">
                          <CheckCircle size={12} /> Your Slot
                        </span>
                      ) : isClaimedByOther ? (
                        <span className="skill-tag" style={{ background: "#cbd5e1", color: "#475569" }}>
                          Booked
                        </span>
                      ) : deadlinePassed ? (
                        <span className="skill-tag skill-missing">
                          Deadline Passed
                        </span>
                      ) : bookedSlot ? (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleChangeSlot(s.id)}
                          disabled={actionLoading}
                          title="Atomically change to this slot (FR-REC-06)"
                        >
                          <RefreshCw size={12} /> Switch Time
                        </button>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleBookSlot(s.id)}
                          disabled={actionLoading}
                        >
                          Book Slot
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Decline / Close Option (FR-REC-07) */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)"
        }}>
          <button 
            className="btn btn-danger btn-sm"
            onClick={handleCloseInterview}
            disabled={actionLoading}
            title="FR-REC-07: Release slot and move application to Candidate Declined"
          >
            <XCircle size={14} /> Close Interview (Decline)
          </button>

          <button 
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
