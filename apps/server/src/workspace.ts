import { createHash, randomUUID } from "node:crypto";
import type { Idea } from "../../../packages/domain/src/agent.ts";
import type {
  ActionProposal,
  ActivityEntry,
  Artifact,
  BrowserSession,
  CalendarEvent,
  Mail,
  ProposalInput,
  Workspace,
} from "../../../packages/domain/src/index.ts";
import { GoogleClient } from "../../../packages/integrations/src/google.ts";
import { createSamplePdf } from "../../../packages/integrations/src/pdf.ts";
import { agentConfigured } from "./agent.ts";
import type { Config } from "./config.ts";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";
import type { Files } from "./files.ts";
import type { GoogleAuth } from "./google-auth.ts";

export class WorkspaceService {
  private seeding = new Map<string, Promise<void>>();
  constructor(
    private readonly db: Store,
    private readonly config: Config,
    private readonly files: Files,
    private readonly googleAuth: GoogleAuth,
  ) {}
  google(owner: string, connectionId?: string) {
    return new GoogleClient({
      getAccessToken: () => this.googleAuth.accessToken(owner, connectionId),
    });
  }
  async connection(owner: string) {
    if (this.config.mode === "sample") {
      const value = await this.db.get<{ enabled: boolean; connectionId?: string }>(
        owner,
        "settings",
        "google",
      );
      return value?.enabled === false
        ? null
        : { id: value?.connectionId ?? "sample-google", account: "alex@example.com" };
    }
    const tokens = await this.googleAuth.tokens(owner);
    return tokens ? { id: tokens.connectionId, account: tokens.account } : null;
  }
  async connected(owner: string) {
    return this.config.mode === "sample"
      ? (await this.db.get<{ enabled: boolean }>(owner, "settings", "google"))?.enabled !== false
      : Boolean(await this.googleAuth.tokens(owner));
  }
  async calendars(owner: string) {
    const connection = await this.connection(owner);
    if (!connection) return [];
    if (this.config.mode === "sample")
      return [
        {
          id: "primary",
          name: "Personal",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          accessRole: "owner",
        },
      ];
    return this.google(owner, connection.id).listCalendars();
  }
  async events(
    owner: string,
    options: { calendarId?: string; timeMin?: string; timeMax?: string } = {},
  ) {
    const connection = await this.connection(owner);
    if (!connection) return [];
    if (this.config.mode === "live") return this.google(owner, connection.id).listEvents(options);
    return (await this.db.list<CalendarEvent>(owner, "events"))
      .filter(
        (event) =>
          event.calendarId === (options.calendarId ?? "primary") &&
          (!options.timeMax || Date.parse(event.start) < Date.parse(options.timeMax)) &&
          (!options.timeMin || Date.parse(event.end) > Date.parse(options.timeMin)),
      )
      .sort((a, b) => a.start.localeCompare(b.start));
  }
  private async cacheMail(owner: string, mail: Mail[], connectionId: string) {
    const imports = await this.db.list<{ id: string; artifactId: string; connectionId?: string }>(
      owner,
      "imports",
    );
    const result = mail.map((message) => ({
      ...message,
      attachments: message.attachments.map(
        (ref) =>
          imports.find((i) => i.id === ref && i.connectionId === connectionId)?.artifactId ?? ref,
      ),
    }));
    for (const message of result) await this.db.put(owner, "mail", { ...message, connectionId });
    return result;
  }
  async thread(owner: string, id: string) {
    const connection = await this.connection(owner);
    if (!connection) throw new AppError("Google is disconnected", 409);
    const mail =
      this.config.mode === "sample"
        ? (await this.db.list<Mail>(owner, "mail")).filter((m) => m.threadId === id)
        : await this.cacheMail(
            owner,
            await this.google(owner, connection.id).getThread(id),
            connection.id,
          );
    if (!mail.length) throw new AppError("Mail thread not found", 404);
    return mail.sort((a, b) => a.date.localeCompare(b.date));
  }
  async searchMail(owner: string, query: string) {
    const connection = await this.connection(owner);
    if (!connection) throw new AppError("Google is disconnected", 409);
    if (this.config.mode === "live")
      return this.cacheMail(
        owner,
        await this.google(owner, connection.id).listMail(query || "in:inbox"),
        connection.id,
      );
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return (await this.db.list<Mail>(owner, "mail"))
      .filter(
        (message) =>
          !/^Sent\b/i.test(message.label) &&
          words.every((word) =>
            `${message.sender} ${message.from} ${message.subject} ${message.body}`
              .toLowerCase()
              .includes(word),
          ),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  async ensureSample(owner: string) {
    if (this.config.mode !== "sample") return;
    const active = this.seeding.get(owner);
    if (active) return active;
    const task = this.seed(owner).finally(() => this.seeding.delete(owner));
    this.seeding.set(owner, task);
    await task;
  }
  private async seed(owner: string) {
    if (await this.db.get(owner, "settings", "seeded")) return;
    const file = await this.files.import(
      owner,
      "Field trip permission slip.pdf",
      await createSamplePdf(),
      "Gmail · Lincoln Middle School",
    );
    const now = new Date();
    const at = (h: number, m = 0) => {
      const d = new Date(now);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const tomorrow = (h: number, m = 0) => {
      const d = new Date(now);
      d.setDate(now.getDate() + 1);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const mails: Mail[] = [
      {
        id: "mail-fieldtrip",
        threadId: "trip-thread",
        sender: "Lincoln Middle School",
        from: "office@lincoln.example",
        to: ["alex@example.com"],
        subject: "A little reminder: permission slips are due Friday",
        body: "Hi Alex,\n\nOur class is heading to the aquarium this Friday. Please complete the attached permission slip and send it back when you have a moment.\n\nWe’ll leave school at 8:15 AM and return by 4:30 PM. Please pack lunch and a water bottle.\n\nThank you!\nMs. Rivera\n\nThis message is included with your local workspace.",
        date: at(8, 42),
        unread: true,
        label: "School",
        attachments: [file.id],
      },
      {
        id: "mail-design",
        threadId: "design-thread",
        sender: "Sam Torres",
        from: "sam@example.com",
        to: ["alex@example.com"],
        subject: "Soccer practice this week?",
        body: "Hi Alex,\n\nThe team is practicing Thursday at 5 PM in the park. Let me know if your child can make it and I’ll save a spot.\n\nThanks!\nSam\n\nThis message is included with your local workspace.",
        date: at(8, 15),
        unread: true,
        label: "Personal",
        attachments: [],
      },
      {
        id: "mail-stay",
        threadId: "stay-thread",
        sender: "The Seabird",
        from: "stay@seabird.example",
        to: ["alex@example.com"],
        subject: "Your weekend, all sorted",
        body: "Your reservation is confirmed.\n\nCheck-in: Friday, 3 PM\nCheck-out: Sunday, 11 AM\n\nThis fictional reservation demonstrates how Mira can organize travel details.",
        date: at(7, 30),
        unread: false,
        label: "Travel",
        attachments: [],
      },
      {
        id: "mail-studio",
        threadId: "studio-thread",
        sender: "Studio North",
        from: "hello@studionorth.example",
        to: ["alex@example.com"],
        subject: "Notes from our last conversation",
        body: "Thanks for a thoughtful conversation yesterday. Let’s use our next session to review the prototype and pick the three flows for testing.\n\nThis project is part of your local workspace.",
        date: new Date(now.getTime() - 86400000).toISOString(),
        unread: false,
        label: "Work",
        attachments: [],
      },
    ];
    for (const mail of mails) await this.db.put(owner, "mail", mail);
    const base = {
      calendarId: "primary",
      allDay: false,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      description: "A little time to catch up",
      attendees: [],
    };
    for (const event of [
      {
        ...base,
        id: "event-standup",
        title: "A slow start · morning walk",
        start: at(9),
        end: at(9, 30),
        location: "Neighborhood",
      },
      {
        ...base,
        id: "event-review",
        title: "Design catch-up",
        start: at(11),
        end: at(11, 45),
        location: "Studio North",
      },
      {
        ...base,
        id: "event-lunch",
        title: "Lunch with Maya",
        start: at(13),
        end: at(14),
        location: "Little Saint",
      },
      {
        ...base,
        id: "event-math-quiz",
        title: "Math quiz",
        description: "Math quiz · Period 2",
        start: tomorrow(8, 45),
        end: tomorrow(9, 15),
        location: "Lincoln Middle School",
      },
    ])
      await this.db.put(owner, "events", event);
    // The one pending review seeded for the sample workspace stays
    // parent/learning-facing. It is written directly (instead of through
    // actions.propose, which prefixes a verb like "Create") so the review
    // card reads exactly "Review tonight's math study plan". Approving it
    // still flows through the normal action pipeline and creates the
    // matching calendar event.
    const reviewActionId = randomUUID();
    await this.db.put(owner, "actions", {
      id: reviewActionId,
      title: "Review tonight's math study plan",
      kind: "calendar.create",
      data: {
        ...base,
        title: "Tonight's math study plan",
        start: at(19),
        end: at(19, 30),
        location: "Home",
        description: "A quiet block to go over tonight's study plan with Mira",
      },
      connectionId: "sample-google",
      account: "alex@example.com",
      status: "awaiting_review",
      hash: createHash("sha256").update(reviewActionId).digest("hex"),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    } satisfies ActionProposal);
    await this.db.put(owner, "activity", {
      id: randomUUID(),
      actionId: reviewActionId,
      title: "Review tonight's math study plan",
      detail: "Study plan ready for review",
      date: now.toISOString(),
      status: "awaiting_review",
    } satisfies ActivityEntry);
    const formMail = mails.find((mail) => mail.id === "mail-fieldtrip");
    const meetingMail = mails.find((mail) => mail.id === "mail-design");
    if (formMail && meetingMail) {
      const sampleIdea = (
        text: string,
        source: Mail,
        title: string,
        reason: string,
        prompt: string,
        kind: "agent" | "document",
        status: "new" | "dismissed",
      ): Idea => ({
        id: createHash("sha256").update(text).digest("hex"),
        title,
        reason,
        evidence: [
          {
            id: source.id,
            kind: "mail",
            title: source.subject,
            excerpt: source.body.slice(0, 400),
          },
        ],
        prompt,
        kind,
        input: { messageId: source.id },
        status,
        createdAt: now.toISOString(),
      });
      // The two ideas the engine would derive from this sample mailbox stay out of
      // the way so the sample workspace presents its two learning suggestions.
      // Their ids match the deterministic ids the ideas engine generates.
      await this.db.put(
        owner,
        "ideas",
        sampleIdea(
          `document:${formMail.id}:${formMail.body}`,
          formMail,
          `I can help with ${formMail.subject}`,
          `${formMail.sender} sent a document that may need your attention. I can prepare it and a reply for your review.`,
          `Help complete the PDF from “${formMail.subject}” and prepare a reply for review.`,
          "document",
          "dismissed",
        ),
      );
      await this.db.put(
        owner,
        "ideas",
        sampleIdea(
          `coordination:${meetingMail.id}`,
          meetingMail,
          `I can help coordinate ${meetingMail.subject}`,
          `${meetingMail.sender} mentioned getting together. I can check your calendar and prepare a response for review.`,
          `Review the email “${meetingMail.subject}”, check my calendar, and propose a next step.`,
          "agent",
          "dismissed",
        ),
      );
      const quizIdea = sampleIdea(
        "mira:math-quiz-review",
        formMail,
        "I can help you prepare for tomorrow’s math quiz",
        "Your calendar shows a math quiz tomorrow. I can create a focused review plan for you.",
        "Help me prepare for tomorrow’s math quiz. Ask me which topics are covered, then build a focused review plan with a short schedule and a first practice question.",
        "agent",
        "new",
      );
      quizIdea.evidence = [
        {
          id: "event-math-quiz",
          kind: "user",
          title: "Calendar · Math quiz",
          excerpt: "Math quiz · tomorrow, 8:45 AM (Lincoln Middle School)",
        },
      ];
      await this.db.put(owner, "ideas", quizIdea);
      await this.db.put(
        owner,
        "ideas",
        sampleIdea(
          "mira:evening-study-plan",
          formMail,
          "I can help organize your study time this evening",
          "You have several learning tasks coming up. I can make a study plan with focused sessions and healthy breaks.",
          "Help me organize study time this evening. Ask me which assignments are due, then turn them into a study plan with focused sessions and sensible breaks.",
          "agent",
          "new",
        ),
      );
    }
    await this.db.put(owner, "settings", { id: "google", enabled: true });
    await this.db.put(owner, "settings", { id: "seeded", value: true });
  }
  async snapshot(owner: string, query?: string): Promise<Workspace> {
    let mail: Mail[], events: CalendarEvent[];
    const connected = await this.connected(owner);
    if (this.config.mode === "live" && connected) {
      const connection = await this.connection(owner);
      if (!connection) throw new AppError("Google is disconnected", 409);
      const google = this.google(owner, connection.id);
      [mail, events] = await Promise.all([google.listMail(query), google.listEvents()]);
      mail = await this.cacheMail(owner, mail, connection.id);
      for (const event of events) await this.db.put(owner, "events", event);
    } else if (this.config.mode === "sample" && connected) {
      mail = await this.db.list<Mail>(owner, "mail");
      events = await this.db.list<CalendarEvent>(owner, "events");
      if (query)
        mail = mail.filter((m) =>
          `${m.sender} ${m.subject} ${m.body}`.toLowerCase().includes(query.toLowerCase()),
        );
    } else {
      mail = [];
      events = [];
    }
    const tokens = this.config.mode === "live" ? await this.googleAuth.tokens(owner) : null;
    return {
      mode: this.config.mode,
      profile: {
        name: this.config.mode === "sample" ? "Alex" : "You",
        email: tokens?.account ?? (this.config.mode === "sample" ? "alex@example.com" : ""),
      },
      mail: mail.sort((a, b) => b.date.localeCompare(a.date)),
      events: events.sort((a, b) => a.start.localeCompare(b.start)),
      files: await this.files.list(owner),
      browsers: await this.db.list<BrowserSession>(owner, "browsers"),
      actions: await this.db.list<ActionProposal>(owner, "actions"),
      activity: await this.db.list<ActivityEntry>(owner, "activity"),
      connections: [
        {
          id: "google",
          name: "Google",
          status: connected
            ? this.config.mode === "sample"
              ? "sample"
              : "connected"
            : "disconnected",
          account:
            tokens?.account ?? (this.config.mode === "sample" ? "alex@example.com" : undefined),
          capabilities:
            this.config.mode === "sample" ? ["Gmail", "Calendar"] : (tokens?.scopes ?? []),
        },
        {
          id: "browser",
          name: "Browser",
          status: this.config.workerUrl && this.config.workerToken ? "connected" : "unconfigured",
          capabilities: ["Persistent sessions", "PDF downloads"],
        },
        {
          id: "openbot",
          name: "OpenBot",
          status: "unconfigured",
          capabilities: ["Integration adapter available"],
        },
      ],
      runtime: {
        provider: this.config.agentBackend === "sample" ? "sample" : "model",
        configured: agentConfigured(this.config),
        openbotConfigured: false,
        richThreads: true,
      },
    };
  }
  async prepare(owner: string, input: ProposalInput, connectionId?: string) {
    if (input.kind === "email.send") {
      for (const id of input.data.attachmentIds) await this.files.get(owner, id);
      return { input };
    }
    if (input.kind === "calendar.create" || this.config.mode === "sample") return { input };
    const reviewed = await this.google(owner, connectionId).reviewEvent(
      input.data.calendarId,
      input.data.eventId,
    );
    return {
      input:
        input.kind === "calendar.delete"
          ? { ...input, data: { ...input.data, title: reviewed.event.title } }
          : input,
      target: reviewed.event,
      targetVersion: reviewed.version,
    };
  }
  async execute(
    owner: string,
    input: ProposalInput,
    connectionId?: string,
    targetVersion?: string,
  ): Promise<string> {
    if (this.config.mode === "sample") {
      if (input.kind === "email.send") {
        const id = randomUUID();
        await this.db.put(owner, "mail", {
          id,
          threadId: input.data.threadId ?? id,
          sender: "You",
          from: "alex@example.com",
          to: input.data.to,
          subject: input.data.subject,
          body: input.data.body,
          date: new Date().toISOString(),
          unread: false,
          label: "Sent · local",
          attachments: input.data.attachmentIds,
        });
        return `Saved to local sent mail · ${id}`;
      }
      if (input.kind === "calendar.delete") {
        await this.db.remove(owner, "events", input.data.eventId);
        return "Removed from local calendar";
      }
      const id = input.kind === "calendar.update" ? input.data.eventId : randomUUID();
      await this.db.put(owner, "events", { ...input.data, id });
      return `Saved to local calendar · ${id}`;
    }
    const tokens = await this.googleAuth.tokens(owner);
    if (!tokens) throw new AppError("Google is disconnected", 409);
    const capability = input.kind === "email.send" ? "gmail.send" : "calendar.events";
    if (!tokens.scopes.includes(`https://www.googleapis.com/auth/${capability}`))
      throw new AppError("Enable Google write access in Connections before approving", 403);
    if (tokens.connectionId !== connectionId)
      throw new AppError("Google account or connection changed. Prepare a new action.", 409);
    const google = this.google(owner, connectionId);
    if ((input.kind === "calendar.update" || input.kind === "calendar.delete") && !targetVersion)
      throw new AppError(
        "This calendar review predates target-version checks. Prepare a new review.",
        409,
      );
    if (input.kind === "email.send") {
      const attachments = await Promise.all(
        input.data.attachmentIds.map(async (id) => {
          const file = await this.files.get(owner, id);
          return {
            name: file.name,
            mimeType: file.mimeType,
            bytes: await this.files.bytes(owner, id),
          };
        }),
      );
      const receipt = await google.sendEmail(input.data, attachments);
      return `Gmail sent message · ${receipt.id}`;
    }
    if (input.kind === "calendar.delete") {
      await google.deleteEvent(input.data.calendarId, input.data.eventId, targetVersion);
      await this.db.remove(owner, "events", input.data.eventId);
      return `Deleted Google Calendar event · ${input.data.eventId}`;
    }
    const event =
      input.kind === "calendar.create"
        ? await google.createEvent(input.data)
        : await google.updateEvent(input.data.eventId, input.data, targetVersion);
    await this.db.put(owner, "events", event);
    return `Google Calendar event · ${event.id}`;
  }
  async importAttachment(owner: string, reference: string): Promise<Artifact> {
    const connection = await this.connection(owner);
    if (!connection) throw new AppError("Google is disconnected", 409);
    const cached = await this.db.get<{ artifactId: string; connectionId?: string }>(
      owner,
      "imports",
      reference,
    );
    if (cached && cached.connectionId === connection.id)
      return this.files.signed(owner, await this.files.get(owner, cached.artifactId));
    const [messageId, attachmentId, filename] = reference.split(":");
    if (!messageId || !attachmentId || !filename)
      throw new AppError("Attachment reference is invalid");
    const message = await this.db.get<Mail & { connectionId?: string }>(owner, "mail", messageId);
    if (!message?.attachments.includes(reference) || message.connectionId !== connection.id)
      throw new AppError("Attachment not found. Refresh the current account's inbox.", 404);
    const file = await this.files.import(
      owner,
      decodeURIComponent(filename),
      await this.google(owner, connection.id).getAttachment(messageId, attachmentId),
      `Gmail · ${message.subject}`,
    );
    await this.db.put(owner, "imports", {
      id: reference,
      artifactId: file.id,
      connectionId: connection.id,
    });
    return file;
  }
}
