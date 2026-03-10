import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const ADMIN_PASSWORD = "CGEadmin2026";
const STORAGE_KEY = "cge_admin";

type Event = {
  id: number;
  title: string;
  city: string | null;
  region: string;
  date: string;
  imageUrl: string;
  ticketLink: string | null;
  description: string;
};

type Booking = {
  id: number;
  mode: string | null;
  eventName: string | null;
  venueName: string;
  contactName: string | null;
  phone: string | null;
  email: string;
  eventDate: string;
  eventTime: string | null;
  city: string | null;
  region: string;
  eventType: string;
  eventTypeOther: string | null;
  budgetRange: string | null;
  instagramHandle: string | null;
  createdAt: string | null;
};

type EventForm = {
  title: string;
  city: string;
  region: string;
  date: string;
  ticketLink: string;
  imageUrl: string;
};

const emptyForm: EventForm = {
  title: "",
  city: "",
  region: "",
  date: "",
  ticketLink: "",
  imageUrl: "",
};

export default function Admin() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [activeTab, setActiveTab] = useState<"events" | "bookings">("events");

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    enabled: authed,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    enabled: authed && activeTab === "bookings",
  });

  const invalidateEvents = () => {
    qc.invalidateQueries({ queryKey: ["/api/events"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: EventForm) => {
      const res = await apiRequest("POST", "/api/events", {
        title: data.title,
        city: data.city || null,
        region: data.region,
        date: data.date,
        ticketLink: data.ticketLink || "#",
        imageUrl: data.imageUrl || "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateEvents();
      resetForm();
      toast({ title: "Event created" });
    },
    onError: () => toast({ title: "Failed to create event", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventForm }) => {
      const res = await apiRequest("PUT", `/api/events/${id}`, {
        title: data.title,
        city: data.city || null,
        region: data.region,
        date: data.date,
        ticketLink: data.ticketLink || "#",
        imageUrl: data.imageUrl || "",
        description: data.city ? `Live event in ${data.city}, NJ` : "CGE Event",
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateEvents();
      resetForm();
      toast({ title: "Event updated" });
    },
    onError: () => toast({ title: "Failed to update event", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      invalidateEvents();
      toast({ title: "Event deleted" });
    },
    onError: () => toast({ title: "Failed to delete event", variant: "destructive" }),
  });

  function handleLogin() {
    if (passwordInput === ADMIN_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setPasswordInput("");
  }

  function openAdd() {
    setEditingEvent(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      city: event.city || "",
      region: event.region,
      date: event.date,
      ticketLink: event.ticketLink || "",
      imageUrl: event.imageUrl || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setShowForm(false);
    setEditingEvent(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.region || !form.date) {
      toast({ title: "Title, Region, and Date are required", variant: "destructive" });
      return;
    }
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleDelete(event: Event) {
    if (window.confirm(`Delete "${event.title}"?`)) {
      deleteMutation.mutate(event.id);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary text-xl font-black">C</span>
            </div>
            <h1 className="text-2xl font-black text-white">CGE Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your password to continue</p>
          </div>
          <div className="bg-secondary/40 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Password</Label>
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
                className="bg-black/40 border-white/10 h-11"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-400 text-sm">Incorrect password. Try again.</p>
              )}
            </div>
            <Button onClick={handleLogin} className="w-full bg-primary hover:bg-primary/90 h-11 font-semibold">
              Enter Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">CGE Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your events and bookings</p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "events" && !showForm && (
              <Button onClick={openAdd} className="bg-primary hover:bg-primary/90 font-semibold">
                + Add New Event
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout} className="border-white/20 hover:bg-white/10 text-white/70">
              Logout
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-8 w-fit">
          <button
            data-testid="admin-tab-events"
            onClick={() => { setActiveTab("events"); resetForm(); }}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "events"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Events
          </button>
          <button
            data-testid="admin-tab-bookings"
            onClick={() => setActiveTab("bookings")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === "bookings"
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            Bookings
          </button>
        </div>

        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <>
            {/* Add / Edit Form */}
            {showForm && (
              <div className="bg-secondary/40 border border-white/10 rounded-2xl p-6 mb-8">
                <h2 className="text-xl font-bold text-white mb-6">
                  {editingEvent ? `Editing: ${editingEvent.title}` : "Add New Event"}
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Event Title *</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. JAZZY FRIDAYS"
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/80">City</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="e.g. Fort Lee"
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/80">Region *</Label>
                    <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                      <SelectTrigger className="bg-black/40 border-white/10 h-11">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent className="bg-secondary border-white/10 text-white">
                        <SelectItem value="North NJ">North NJ</SelectItem>
                        <SelectItem value="Central NJ">Central NJ</SelectItem>
                        <SelectItem value="South NJ">South NJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/80">Date *</Label>
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/80">Ticket Link</Label>
                    <Input
                      value={form.ticketLink}
                      onChange={(e) => setForm({ ...form, ticketLink: e.target.value })}
                      placeholder="https://..."
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-white/80">Image URL</Label>
                    <Input
                      value={form.imageUrl}
                      onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                      placeholder="https://... (leave blank to use default)"
                      className="bg-black/40 border-white/10 h-11"
                    />
                  </div>

                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 font-semibold px-8">
                      {isPending ? "Saving..." : editingEvent ? "Save Changes" : "Create Event"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm} className="border-white/20 hover:bg-white/10 text-white/70">
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Events Table */}
            <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-bold text-white">
                  All Events <span className="text-muted-foreground font-normal text-sm ml-2">({events.length} total)</span>
                </h2>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">Loading...</div>
              ) : events.length === 0 ? (
                <div className="flex justify-center items-center h-40 text-muted-foreground">No events yet. Add one above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground text-left">
                        <th className="px-6 py-3 font-medium">Title</th>
                        <th className="px-4 py-3 font-medium">City</th>
                        <th className="px-4 py-3 font-medium">Region</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Ticket Link</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event, i) => (
                        <tr
                          key={event.id}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                        >
                          <td className="px-6 py-4 font-medium text-white max-w-xs">
                            <span className="line-clamp-2">{event.title}</span>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{event.city || "—"}</td>
                          <td className="px-4 py-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">
                              {event.region}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{event.date}</td>
                          <td className="px-4 py-4 text-muted-foreground max-w-[160px]">
                            {event.ticketLink && event.ticketLink !== "#" ? (
                              <a href={event.ticketLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">
                                {event.ticketLink}
                              </a>
                            ) : (
                              <span className="text-white/20">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(event)}
                              className="border-white/20 hover:bg-white/10 text-white/70 mr-2 text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(event)}
                              disabled={deleteMutation.isPending}
                              className="border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs"
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* BOOKINGS TAB */}
        {activeTab === "bookings" && (
          <div className="bg-secondary/30 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="font-bold text-white">
                All Submissions <span className="text-muted-foreground font-normal text-sm ml-2">({bookings.length} total)</span>
              </h2>
            </div>

            {bookingsLoading ? (
              <div className="flex justify-center items-center h-40 text-muted-foreground">Loading...</div>
            ) : bookings.length === 0 ? (
              <div className="flex justify-center items-center h-40 text-muted-foreground">No submissions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground text-left">
                      <th className="px-4 py-3 font-medium">Mode</th>
                      <th className="px-4 py-3 font-medium">Event Name</th>
                      <th className="px-4 py-3 font-medium">Venue</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Region</th>
                      <th className="px-4 py-3 font-medium">Date Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking, i) => (
                      <tr
                        key={booking.id}
                        data-testid={`row-booking-${booking.id}`}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                      >
                        <td className="px-4 py-4">
                          <span
                            data-testid={`badge-mode-${booking.id}`}
                            className={`inline-block px-3 py-0.5 rounded-full text-xs font-semibold border ${
                              booking.mode === "Premium"
                                ? "bg-primary/15 border-primary/40 text-primary"
                                : "bg-white/5 border-white/20 text-white/60"
                            }`}
                          >
                            {booking.mode || "Standard"}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-white max-w-[180px]">
                          <span className="line-clamp-1">{booking.eventName || "—"}</span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground max-w-[160px]">
                          <span className="line-clamp-1">{booking.venueName}</span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <a href={`mailto:${booking.email}`} className="text-primary hover:underline">
                            {booking.email}
                          </a>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs border border-primary/30 text-primary bg-primary/10">
                            {booking.region}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">
                          {booking.createdAt
                            ? new Date(booking.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
