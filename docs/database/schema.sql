--
-- Gita Mail (Email Analytics): the PostgreSQL schema, for reference.
-- Generated from a database with every migration in server/migrations.ts applied (011 to 013 included).
-- The app creates and updates these tables itself when it starts; do not run this file against the live
-- database. A readable explanation of every table is in docs/DATABASE_SCHEMA.md.
--
--
-- PostgreSQL database dump
--

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

--
-- Name: action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_items (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    conversation_id bigint,
    customer_id bigint,
    description text NOT NULL,
    owner_side text DEFAULT 'us'::text NOT NULL,
    owner_name text,
    is_commitment boolean DEFAULT false NOT NULL,
    due_date date,
    status text DEFAULT 'open'::text NOT NULL,
    assignee_id bigint,
    fingerprint text NOT NULL,
    source_email_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    source text DEFAULT 'ai'::text NOT NULL,
    created_by bigint,
    reminder_sent_at timestamp with time zone,
    notes text,
    CONSTRAINT action_items_owner_side_check CHECK ((owner_side = ANY (ARRAY['us'::text, 'customer'::text]))),
    CONSTRAINT action_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text, 'dismissed'::text])))
);

--
-- Name: action_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: action_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_items_id_seq OWNED BY public.action_items.id;

--
-- Name: ai_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_state (
    id integer DEFAULT 1 NOT NULL,
    paused_until timestamp with time zone,
    last_error text,
    last_error_at timestamp with time zone,
    provider text,
    CONSTRAINT ai_state_id_check CHECK ((id = 1))
);

--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage (
    id bigint NOT NULL,
    org_id bigint,
    model text NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    purpose text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ai_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ai_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ai_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ai_usage_id_seq OWNED BY public.ai_usage.id;

--
-- Name: alert_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_rules (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    rule_type text NOT NULL,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    severity text DEFAULT 'high'::text NOT NULL,
    channels text[] DEFAULT '{in_app,email}'::text[] NOT NULL,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    escalate_after_minutes integer,
    escalation_recipients text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_rules_rule_type_check CHECK ((rule_type = ANY (ARRAY['rag_red'::text, 'negative_key_customer'::text, 'escalation_risk'::text, 'keyword'::text, 'sla_breach'::text, 'health_drop'::text, 'action_overdue'::text, 'proposal_deadline'::text]))),
    CONSTRAINT alert_rules_severity_check CHECK ((severity = ANY (ARRAY['medium'::text, 'high'::text, 'critical'::text])))
);

--
-- Name: alert_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alert_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: alert_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alert_rules_id_seq OWNED BY public.alert_rules.id;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    rule_id bigint,
    conversation_id bigint,
    customer_id bigint,
    severity text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    dedup_key text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    escalation_level integer DEFAULT 0 NOT NULL,
    escalated_at timestamp with time zone,
    acknowledged_by bigint,
    acknowledged_at timestamp with time zone,
    delivered jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alerts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text])))
);

--
-- Name: alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;

--
-- Name: analytics_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_runs (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    trigger text DEFAULT 'schedule'::text NOT NULL,
    status text DEFAULT 'running'::text NOT NULL,
    steps jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    CONSTRAINT analytics_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: analytics_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: analytics_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_runs_id_seq OWNED BY public.analytics_runs.id;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    saved boolean DEFAULT false NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    filename text NOT NULL,
    content_type text DEFAULT 'application/octet-stream'::text NOT NULL,
    size integer NOT NULL,
    data bytea NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_keywords text DEFAULT ''::text NOT NULL
);

--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    org_id bigint,
    user_id bigint,
    user_email text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

--
-- Name: book_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_requests (
    org_id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    customer_id bigint,
    code text NOT NULL,
    nearest text,
    hq_qty numeric,
    near_qty numeric,
    requested_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: book_titles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.book_titles (
    org_id bigint NOT NULL,
    code text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    language text DEFAULT ''::text NOT NULL,
    hindi_title text,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hindi_raw text,
    gitapress_url text,
    amazon_url text,
    family text,
    family_manual boolean DEFAULT false NOT NULL,
    status text DEFAULT 'needs_details'::text NOT NULL,
    category text,
    mrp numeric,
    lead_days integer,
    cover_days integer,
    min_print integer,
    in_master boolean DEFAULT false NOT NULL,
    flags text[] DEFAULT '{}'::text[] NOT NULL,
    updated_by bigint,
    CONSTRAINT book_titles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'needs_details'::text, 'removed'::text])))
);

--
-- Name: catalogues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogues (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    category text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    url text,
    file_name text,
    bytes bytea,
    content_type text,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint,
    deleted_at timestamp with time zone
);

--
-- Name: catalogues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.catalogues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: catalogues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.catalogues_id_seq OWNED BY public.catalogues.id;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    customer_id bigint,
    email text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text
);

--
-- Name: contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contacts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contacts_id_seq OWNED BY public.contacts.id;

--
-- Name: conversation_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_keys (
    conversation_id bigint NOT NULL,
    key text NOT NULL
);

--
-- Name: conversation_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_notes (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    user_id bigint,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: conversation_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversation_notes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: conversation_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversation_notes_id_seq OWNED BY public.conversation_notes.id;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    customer_id bigint,
    subject text DEFAULT ''::text NOT NULL,
    normalized_subject text DEFAULT ''::text NOT NULL,
    first_message_at timestamp with time zone,
    last_message_at timestamp with time zone,
    last_inbound_at timestamp with time zone,
    last_outbound_at timestamp with time zone,
    message_count integer DEFAULT 0 NOT NULL,
    inbound_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    mailbox_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    participants text[] DEFAULT '{}'::text[] NOT NULL,
    awaiting_reply boolean DEFAULT false NOT NULL,
    first_response_minutes integer,
    summary text,
    sentiment text,
    sentiment_score real,
    rag text,
    rag_reason text,
    customer_state text,
    urgency text,
    escalation_risk integer,
    priority_score integer DEFAULT 0 NOT NULL,
    categories text[] DEFAULT '{}'::text[] NOT NULL,
    topics text[] DEFAULT '{}'::text[] NOT NULL,
    entities jsonb DEFAULT '{}'::jsonb NOT NULL,
    suggested_reply text,
    analysis_model text,
    analysed_at timestamp with time zone,
    needs_analysis boolean DEFAULT true NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    assignee_id bigint,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_category text DEFAULT 'other'::text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    is_automated boolean DEFAULT false NOT NULL,
    staff_participants text[] DEFAULT '{}'::text[] NOT NULL,
    proposal jsonb,
    proposal_stage text,
    proposal_stage_locked boolean DEFAULT false NOT NULL,
    category_locked boolean DEFAULT false NOT NULL,
    subcategory text,
    subcategory_locked boolean DEFAULT false NOT NULL,
    purposes text[] DEFAULT '{}'::text[] NOT NULL,
    purposes_locked boolean DEFAULT false NOT NULL,
    purposes_at timestamp with time zone,
    CONSTRAINT conversations_customer_state_check CHECK ((customer_state = ANY (ARRAY['satisfied'::text, 'neutral'::text, 'at_risk'::text, 'dissatisfied'::text]))),
    CONSTRAINT conversations_rag_check CHECK ((rag = ANY (ARRAY['red'::text, 'amber'::text, 'green'::text]))),
    CONSTRAINT conversations_sentiment_check CHECK ((sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text]))),
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'ignored'::text]))),
    CONSTRAINT conversations_urgency_check CHECK ((urgency = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;

--
-- Name: customer_health_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_health_daily (
    customer_id bigint NOT NULL,
    day date NOT NULL,
    health_score integer NOT NULL,
    negative_pct real DEFAULT 0 NOT NULL,
    red_count integer DEFAULT 0 NOT NULL,
    email_count integer DEFAULT 0 NOT NULL
);

--
-- Name: customer_phones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_phones (
    org_id bigint NOT NULL,
    phone10 text NOT NULL,
    customer_id bigint NOT NULL,
    source text DEFAULT ''::text NOT NULL
);

--
-- Name: customer_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_reviews (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    kind text NOT NULL,
    customer_a bigint NOT NULL,
    customer_b bigint NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by bigint,
    decided_at timestamp with time zone,
    CONSTRAINT customer_reviews_kind_check CHECK ((kind = ANY (ARRAY['email_phone'::text, 'name_pin'::text]))),
    CONSTRAINT customer_reviews_status_check CHECK ((status = ANY (ARRAY['open'::text, 'merged'::text, 'dismissed'::text])))
);

--
-- Name: customer_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customer_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_reviews_id_seq OWNED BY public.customer_reviews.id;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    name text NOT NULL,
    domains text[] DEFAULT '{}'::text[] NOT NULL,
    tier text DEFAULT 'standard'::text NOT NULL,
    account_owner text,
    notes text,
    health_score integer,
    health_status text,
    health_trend integer DEFAULT 0 NOT NULL,
    last_contact_at timestamp with time zone,
    auto_created boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'customer'::text NOT NULL,
    kind_locked boolean DEFAULT false NOT NULL,
    profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    profile_manual jsonb DEFAULT '{}'::jsonb NOT NULL,
    profile_source text,
    profile_at timestamp with time zone,
    enrichment jsonb DEFAULT '{}'::jsonb NOT NULL,
    enriched_at timestamp with time zone,
    purposes text[] DEFAULT '{}'::text[] NOT NULL,
    from_uploads boolean DEFAULT false NOT NULL,
    upload_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    orders_count integer DEFAULT 0 NOT NULL,
    orders_spend numeric DEFAULT 0 NOT NULL,
    orders_first timestamp with time zone,
    orders_last timestamp with time zone,
    orders_12m integer DEFAULT 0 NOT NULL,
    spend_12m numeric DEFAULT 0 NOT NULL,
    payment_methods text[] DEFAULT '{}'::text[] NOT NULL,
    last_order_status text,
    kalyan_buyer boolean DEFAULT false NOT NULL,
    kalyan_custnos text[] DEFAULT '{}'::text[] NOT NULL,
    kalyan_type text,
    kalyan_first date,
    kalyan_last date,
    kalyan_mode text,
    kalyan_renewal date,
    kalyan_start_known boolean DEFAULT false NOT NULL,
    buyer_tier text DEFAULT 'regular'::text NOT NULL,
    buyer_points numeric DEFAULT 0 NOT NULL,
    buyer_why text[] DEFAULT '{}'::text[] NOT NULL,
    data_gaps text[] DEFAULT '{}'::text[] NOT NULL,
    matched_by text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT customers_buyer_tier_check CHECK ((buyer_tier = ANY (ARRAY['platinum'::text, 'gold'::text, 'silver'::text, 'regular'::text]))),
    CONSTRAINT customers_health_status_check CHECK ((health_status = ANY (ARRAY['satisfied'::text, 'neutral'::text, 'at_risk'::text, 'dissatisfied'::text]))),
    CONSTRAINT customers_tier_check CHECK ((tier = ANY (ARRAY['strategic'::text, 'key'::text, 'standard'::text])))
);

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emails (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    mailbox_id bigint NOT NULL,
    conversation_id bigint,
    provider_message_id text NOT NULL,
    internet_message_id text,
    provider_thread_id text,
    in_reply_to text,
    dedup_key text NOT NULL,
    content_hash text NOT NULL,
    is_duplicate boolean DEFAULT false NOT NULL,
    duplicate_of bigint,
    direction text NOT NULL,
    from_address text DEFAULT ''::text NOT NULL,
    from_name text DEFAULT ''::text NOT NULL,
    to_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    cc_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    body_text text DEFAULT ''::text NOT NULL,
    body_clean text DEFAULT ''::text NOT NULL,
    snippet text DEFAULT ''::text NOT NULL,
    has_attachments boolean DEFAULT false NOT NULL,
    importance text,
    web_link text,
    sent_at timestamp with time zone NOT NULL,
    sentiment text,
    sentiment_score real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_automated boolean DEFAULT false NOT NULL,
    forwarded_by text,
    forward_note text,
    CONSTRAINT emails_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text, 'internal'::text]))),
    CONSTRAINT emails_sentiment_check CHECK ((sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])))
);

--
-- Name: emails_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emails_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emails_id_seq OWNED BY public.emails.id;

--
-- Name: issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.issues (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    customer_id bigint,
    category text NOT NULL,
    description text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT issues_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);

--
-- Name: issues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.issues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.issues_id_seq OWNED BY public.issues.id;

--
-- Name: kalyan_dispatches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kalyan_dispatches (
    org_id bigint NOT NULL,
    custno text NOT NULL,
    from_issue smallint NOT NULL,
    to_issue smallint NOT NULL,
    dispdate date NOT NULL,
    occ smallint DEFAULT 1 NOT NULL,
    mode text DEFAULT ''::text NOT NULL,
    barcode text,
    subperiod text DEFAULT ''::text NOT NULL,
    batch_id bigint
);

--
-- Name: kalyan_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kalyan_stage (
    batch_id bigint NOT NULL,
    rowno integer NOT NULL,
    custno text NOT NULL,
    subperiod text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    pin text DEFAULT ''::text NOT NULL,
    state text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    phone10 text,
    mode text DEFAULT ''::text NOT NULL,
    barcode text,
    dispdate date NOT NULL,
    from_issue smallint NOT NULL,
    to_issue smallint NOT NULL,
    email text,
    email_ok boolean DEFAULT false NOT NULL,
    state_norm text
);

--
-- Name: kalyan_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kalyan_subscribers (
    org_id bigint NOT NULL,
    custno text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    pin text DEFAULT ''::text NOT NULL,
    state text DEFAULT ''::text NOT NULL,
    state_norm text,
    phone text DEFAULT ''::text NOT NULL,
    phone10 text,
    email text,
    email_ok boolean DEFAULT false NOT NULL,
    sub_type text DEFAULT ''::text NOT NULL,
    mode text DEFAULT ''::text NOT NULL,
    first_dispatch date,
    last_dispatch date,
    first_issue_ym text,
    last_issue_ym text,
    dispatches integer DEFAULT 0 NOT NULL,
    start_known boolean DEFAULT false NOT NULL,
    renewal_est date,
    customer_id bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: mailboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailboxes (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    provider text NOT NULL,
    address text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    credentials_enc text,
    status text DEFAULT 'active'::text NOT NULL,
    last_error text,
    sync_state jsonb DEFAULT '{}'::jsonb NOT NULL,
    backfill_days integer DEFAULT 90 NOT NULL,
    last_synced_at timestamp with time zone,
    messages_synced bigint DEFAULT 0 NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mailboxes_provider_check CHECK ((provider = ANY (ARRAY['microsoft'::text, 'microsoft_app'::text, 'gmail'::text, 'gmail_app'::text, 'upload'::text, 'demo'::text]))),
    CONSTRAINT mailboxes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'error'::text, 'pending'::text])))
);

--
-- Name: mailboxes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mailboxes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: mailboxes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mailboxes_id_seq OWNED BY public.mailboxes.id;

--
-- Name: oauth_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.oauth_states (
    state text NOT NULL,
    user_id bigint,
    provider text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    org_id bigint NOT NULL,
    order_key text NOT NULL,
    status_code text,
    status_label text,
    payment_status text,
    tracking_id text,
    batch_id bigint,
    seen_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    org_id bigint NOT NULL,
    order_key text NOT NULL,
    order_id text NOT NULL,
    mongo_id text,
    site text,
    customer_name text DEFAULT ''::text NOT NULL,
    email text,
    email_ok boolean DEFAULT false NOT NULL,
    phone text,
    phone10 text,
    total numeric,
    subtotal numeric,
    postage numeric,
    payment_method text,
    status_code text,
    status_label text,
    payment_status text,
    ordered_at timestamp with time zone,
    tracking_id text,
    tracking_ok boolean DEFAULT false NOT NULL,
    partner_raw text,
    partner text,
    ship_name text,
    ship_address text,
    ship_city text,
    ship_pin text,
    ship_phone10 text,
    customer_id bigint,
    row_hash text DEFAULT ''::text NOT NULL,
    first_batch bigint,
    last_batch bigint,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: organisations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organisations (
    id bigint NOT NULL,
    name text NOT NULL,
    internal_domains text[] DEFAULT '{}'::text[] NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: organisations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organisations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: organisations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organisations_id_seq OWNED BY public.organisations.id;

--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: password_resets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_resets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: password_resets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_resets_id_seq OWNED BY public.password_resets.id;

--
-- Name: purpose_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purpose_defs (
    org_id bigint NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    group_name text DEFAULT 'Other'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    locked boolean DEFAULT false NOT NULL,
    builtin boolean DEFAULT false NOT NULL,
    merged_into text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint
);

--
-- Name: purpose_retags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purpose_retags (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    key text NOT NULL,
    last_conversation_id bigint DEFAULT 0 NOT NULL,
    checked integer DEFAULT 0 NOT NULL,
    tagged integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT purpose_retags_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'done'::text])))
);

--
-- Name: purpose_retags_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purpose_retags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: purpose_retags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purpose_retags_id_seq OWNED BY public.purpose_retags.id;

--
-- Name: reference_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reference_items (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    kind text NOT NULL,
    code text,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reference_items_kind_check CHECK ((kind = ANY (ARRAY['book'::text, 'faq'::text, 'policy'::text])))
);

--
-- Name: reference_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reference_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: reference_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reference_items_id_seq OWNED BY public.reference_items.id;

--
-- Name: reply_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_drafts (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    generated_body text DEFAULT ''::text NOT NULL,
    model text,
    edited boolean DEFAULT false NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    to_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    cc_addresses text[] DEFAULT '{}'::text[] NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    reply_to_email_id bigint,
    send_mailbox_id bigint,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint,
    sent_at timestamp with time zone,
    sent_by bigint,
    provider_message_id text,
    last_error text,
    attachment_ids bigint[] DEFAULT '{}'::bigint[] NOT NULL,
    quote_original boolean DEFAULT true NOT NULL,
    sender_chosen boolean DEFAULT false NOT NULL,
    CONSTRAINT reply_drafts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'dismissed'::text, 'replied_elsewhere'::text])))
);

--
-- Name: reply_drafts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reply_drafts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: reply_drafts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reply_drafts_id_seq OWNED BY public.reply_drafts.id;

--
-- Name: reply_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reply_templates (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    group_key text NOT NULL,
    subgroup_key text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    guidance text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by bigint
);

--
-- Name: reply_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reply_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: reply_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reply_templates_id_seq OWNED BY public.reply_templates.id;

--
-- Name: report_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_runs (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    schedule_id bigint,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    html text NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    delivery_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: report_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: report_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_runs_id_seq OWNED BY public.report_runs.id;

--
-- Name: report_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_schedules (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    name text NOT NULL,
    frequency text NOT NULL,
    hour_utc integer DEFAULT 7 NOT NULL,
    day_of_week integer DEFAULT 1,
    day_of_month integer DEFAULT 1,
    recipients text[] DEFAULT '{}'::text[] NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_run_at timestamp with time zone,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT report_schedules_day_of_month_check CHECK (((day_of_month >= 1) AND (day_of_month <= 28))),
    CONSTRAINT report_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT report_schedules_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT report_schedules_hour_utc_check CHECK (((hour_utc >= 0) AND (hour_utc <= 23)))
);

--
-- Name: report_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.report_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: report_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.report_schedules_id_seq OWNED BY public.report_schedules.id;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    ip_address text,
    user_agent text,
    iam_token_enc text
);

--
-- Name: stock_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_files (
    upload_id bigint NOT NULL,
    bytes bytea NOT NULL,
    content_type text DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'::text NOT NULL
);

--
-- Name: stock_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_rows (
    upload_id bigint NOT NULL,
    org_id bigint NOT NULL,
    location text NOT NULL,
    godown text DEFAULT ''::text NOT NULL,
    godown_kind text NOT NULL,
    code text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    language text DEFAULT ''::text NOT NULL,
    batch text DEFAULT ''::text NOT NULL,
    price numeric,
    opening_qty numeric DEFAULT 0 NOT NULL,
    in_qty numeric DEFAULT 0 NOT NULL,
    out_qty numeric DEFAULT 0 NOT NULL,
    closing_qty numeric DEFAULT 0 NOT NULL,
    out_value numeric DEFAULT 0 NOT NULL,
    closing_value numeric DEFAULT 0 NOT NULL
);

--
-- Name: stock_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_uploads (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    scope text NOT NULL,
    file_name text DEFAULT ''::text NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    locations text[] DEFAULT '{}'::text[] NOT NULL,
    sheets jsonb DEFAULT '[]'::jsonb NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    warnings text[] DEFAULT '{}'::text[] NOT NULL,
    uploaded_by bigint,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by bigint,
    deleted_reason text,
    replaced_locations text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT stock_uploads_scope_check CHECK ((scope = ANY (ARRAY['hq'::text, 'branch'::text])))
);

--
-- Name: stock_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stock_uploads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: stock_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stock_uploads_id_seq OWNED BY public.stock_uploads.id;

--
-- Name: sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sync_runs (
    id bigint NOT NULL,
    mailbox_id bigint,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    fetched integer DEFAULT 0 NOT NULL,
    inserted integer DEFAULT 0 NOT NULL,
    duplicates integer DEFAULT 0 NOT NULL,
    error text
);

--
-- Name: sync_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sync_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: sync_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sync_runs_id_seq OWNED BY public.sync_runs.id;

--
-- Name: upload_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_batches (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    kind text NOT NULL,
    file_name text DEFAULT ''::text NOT NULL,
    file_size bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'receiving'::text NOT NULL,
    step text,
    header text[] DEFAULT '{}'::text[] NOT NULL,
    rows_received integer DEFAULT 0 NOT NULL,
    rows_total integer DEFAULT 0 NOT NULL,
    rows_new integer DEFAULT 0 NOT NULL,
    rows_updated integer DEFAULT 0 NOT NULL,
    rows_unchanged integer DEFAULT 0 NOT NULL,
    rows_rejected integer DEFAULT 0 NOT NULL,
    profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    warnings text[] DEFAULT '{}'::text[] NOT NULL,
    error text,
    timing jsonb DEFAULT '{}'::jsonb NOT NULL,
    uploaded_by bigint,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by bigint,
    deleted_reason text,
    CONSTRAINT upload_batches_kind_check CHECK ((kind = ANY (ARRAY['orders'::text, 'kalyan'::text, 'books'::text, 'prices'::text]))),
    CONSTRAINT upload_batches_status_check CHECK ((status = ANY (ARRAY['receiving'::text, 'queued'::text, 'processing'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: upload_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.upload_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: upload_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.upload_batches_id_seq OWNED BY public.upload_batches.id;

--
-- Name: upload_file_parts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_file_parts (
    batch_id bigint NOT NULL,
    seq integer NOT NULL,
    bytes bytea NOT NULL
);

--
-- Name: upload_stage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.upload_stage (
    batch_id bigint NOT NULL,
    rowno integer NOT NULL,
    data jsonb NOT NULL
);

--
-- Name: user_mailboxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_mailboxes (
    user_id bigint NOT NULL,
    mailbox_id bigint NOT NULL
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    org_id bigint NOT NULL,
    email text NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    auth_provider text DEFAULT 'local'::text NOT NULL,
    external_id text,
    password_hash text,
    is_active boolean DEFAULT true NOT NULL,
    all_mailboxes boolean DEFAULT false NOT NULL,
    timezone text DEFAULT 'America/Toronto'::text NOT NULL,
    notify_email boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ms_object_id text,
    email_aliases text[] DEFAULT '{}'::text[] NOT NULL,
    digest_enabled boolean DEFAULT true NOT NULL,
    last_digest_at timestamp with time zone,
    ravity_space_key text,
    google_sub text,
    CONSTRAINT users_auth_provider_check CHECK ((auth_provider = ANY (ARRAY['local'::text, 'ravity'::text, 'microsoft'::text, 'google'::text]))),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'analyst'::text, 'viewer'::text])))
);

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: worker_lease; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_lease (
    name text NOT NULL,
    holder text,
    until timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: action_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items ALTER COLUMN id SET DEFAULT nextval('public.action_items_id_seq'::regclass);

--
-- Name: ai_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage ALTER COLUMN id SET DEFAULT nextval('public.ai_usage_id_seq'::regclass);

--
-- Name: alert_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules ALTER COLUMN id SET DEFAULT nextval('public.alert_rules_id_seq'::regclass);

--
-- Name: alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);

--
-- Name: analytics_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_runs ALTER COLUMN id SET DEFAULT nextval('public.analytics_runs_id_seq'::regclass);

--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);

--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);

--
-- Name: catalogues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogues ALTER COLUMN id SET DEFAULT nextval('public.catalogues_id_seq'::regclass);

--
-- Name: contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts ALTER COLUMN id SET DEFAULT nextval('public.contacts_id_seq'::regclass);

--
-- Name: conversation_notes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_notes ALTER COLUMN id SET DEFAULT nextval('public.conversation_notes_id_seq'::regclass);

--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);

--
-- Name: customer_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews ALTER COLUMN id SET DEFAULT nextval('public.customer_reviews_id_seq'::regclass);

--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);

--
-- Name: emails id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails ALTER COLUMN id SET DEFAULT nextval('public.emails_id_seq'::regclass);

--
-- Name: issues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues ALTER COLUMN id SET DEFAULT nextval('public.issues_id_seq'::regclass);

--
-- Name: mailboxes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes ALTER COLUMN id SET DEFAULT nextval('public.mailboxes_id_seq'::regclass);

--
-- Name: organisations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations ALTER COLUMN id SET DEFAULT nextval('public.organisations_id_seq'::regclass);

--
-- Name: password_resets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets ALTER COLUMN id SET DEFAULT nextval('public.password_resets_id_seq'::regclass);

--
-- Name: purpose_retags id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_retags ALTER COLUMN id SET DEFAULT nextval('public.purpose_retags_id_seq'::regclass);

--
-- Name: reference_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_items ALTER COLUMN id SET DEFAULT nextval('public.reference_items_id_seq'::regclass);

--
-- Name: reply_drafts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts ALTER COLUMN id SET DEFAULT nextval('public.reply_drafts_id_seq'::regclass);

--
-- Name: reply_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_templates ALTER COLUMN id SET DEFAULT nextval('public.reply_templates_id_seq'::regclass);

--
-- Name: report_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs ALTER COLUMN id SET DEFAULT nextval('public.report_runs_id_seq'::regclass);

--
-- Name: report_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules ALTER COLUMN id SET DEFAULT nextval('public.report_schedules_id_seq'::regclass);

--
-- Name: stock_uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_uploads ALTER COLUMN id SET DEFAULT nextval('public.stock_uploads_id_seq'::regclass);

--
-- Name: sync_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs ALTER COLUMN id SET DEFAULT nextval('public.sync_runs_id_seq'::regclass);

--
-- Name: upload_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches ALTER COLUMN id SET DEFAULT nextval('public.upload_batches_id_seq'::regclass);

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Name: action_items action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_pkey PRIMARY KEY (id);

--
-- Name: ai_state ai_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_state
    ADD CONSTRAINT ai_state_pkey PRIMARY KEY (id);

--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);

--
-- Name: alert_rules alert_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_pkey PRIMARY KEY (id);

--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);

--
-- Name: analytics_runs analytics_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_runs
    ADD CONSTRAINT analytics_runs_pkey PRIMARY KEY (id);

--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);

--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

--
-- Name: book_requests book_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_pkey PRIMARY KEY (conversation_id, code);

--
-- Name: book_titles book_titles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_titles
    ADD CONSTRAINT book_titles_pkey PRIMARY KEY (org_id, code);

--
-- Name: catalogues catalogues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogues
    ADD CONSTRAINT catalogues_pkey PRIMARY KEY (id);

--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);

--
-- Name: conversation_keys conversation_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_keys
    ADD CONSTRAINT conversation_keys_pkey PRIMARY KEY (key);

--
-- Name: conversation_notes conversation_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_notes
    ADD CONSTRAINT conversation_notes_pkey PRIMARY KEY (id);

--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

--
-- Name: customer_health_daily customer_health_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_health_daily
    ADD CONSTRAINT customer_health_daily_pkey PRIMARY KEY (customer_id, day);

--
-- Name: customer_phones customer_phones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_phones
    ADD CONSTRAINT customer_phones_pkey PRIMARY KEY (org_id, phone10);

--
-- Name: customer_reviews customer_reviews_org_id_kind_customer_a_customer_b_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_org_id_kind_customer_a_customer_b_key UNIQUE (org_id, kind, customer_a, customer_b);

--
-- Name: customer_reviews customer_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_pkey PRIMARY KEY (id);

--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);

--
-- Name: issues issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_pkey PRIMARY KEY (id);

--
-- Name: kalyan_dispatches kalyan_dispatches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_dispatches
    ADD CONSTRAINT kalyan_dispatches_pkey PRIMARY KEY (org_id, custno, from_issue, to_issue, dispdate, occ);

--
-- Name: kalyan_stage kalyan_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_stage
    ADD CONSTRAINT kalyan_stage_pkey PRIMARY KEY (batch_id, rowno);

--
-- Name: kalyan_subscribers kalyan_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_subscribers
    ADD CONSTRAINT kalyan_subscribers_pkey PRIMARY KEY (org_id, custno);

--
-- Name: mailboxes mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT mailboxes_pkey PRIMARY KEY (id);

--
-- Name: oauth_states oauth_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_pkey PRIMARY KEY (state);

--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (org_id, order_key);

--
-- Name: organisations organisations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organisations
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);

--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);

--
-- Name: purpose_defs purpose_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_defs
    ADD CONSTRAINT purpose_defs_pkey PRIMARY KEY (org_id, key);

--
-- Name: purpose_retags purpose_retags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_retags
    ADD CONSTRAINT purpose_retags_pkey PRIMARY KEY (id);

--
-- Name: reference_items reference_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_items
    ADD CONSTRAINT reference_items_pkey PRIMARY KEY (id);

--
-- Name: reply_drafts reply_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_pkey PRIMARY KEY (id);

--
-- Name: reply_templates reply_templates_org_id_group_key_subgroup_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_org_id_group_key_subgroup_key_key UNIQUE (org_id, group_key, subgroup_key);

--
-- Name: reply_templates reply_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_pkey PRIMARY KEY (id);

--
-- Name: report_runs report_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_pkey PRIMARY KEY (id);

--
-- Name: report_schedules report_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_pkey PRIMARY KEY (id);

--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);

--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

--
-- Name: stock_files stock_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_files
    ADD CONSTRAINT stock_files_pkey PRIMARY KEY (upload_id);

--
-- Name: stock_uploads stock_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_uploads
    ADD CONSTRAINT stock_uploads_pkey PRIMARY KEY (id);

--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);

--
-- Name: upload_batches upload_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT upload_batches_pkey PRIMARY KEY (id);

--
-- Name: upload_file_parts upload_file_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_file_parts
    ADD CONSTRAINT upload_file_parts_pkey PRIMARY KEY (batch_id, seq);

--
-- Name: upload_stage upload_stage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_stage
    ADD CONSTRAINT upload_stage_pkey PRIMARY KEY (batch_id, rowno);

--
-- Name: user_mailboxes user_mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mailboxes
    ADD CONSTRAINT user_mailboxes_pkey PRIMARY KEY (user_id, mailbox_id);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: worker_lease worker_lease_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_lease
    ADD CONSTRAINT worker_lease_pkey PRIMARY KEY (name);

--
-- Name: actions_fp_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX actions_fp_uq ON public.action_items USING btree (conversation_id, fingerprint);

--
-- Name: actions_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX actions_org_status_idx ON public.action_items USING btree (org_id, status, due_date);

--
-- Name: alerts_dedup_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX alerts_dedup_uq ON public.alerts USING btree (org_id, dedup_key);

--
-- Name: alerts_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alerts_org_status_idx ON public.alerts USING btree (org_id, status, created_at DESC);

--
-- Name: analytics_runs_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analytics_runs_org_idx ON public.analytics_runs USING btree (org_id, requested_at DESC);

--
-- Name: attachments_saved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attachments_saved_idx ON public.attachments USING btree (org_id) WHERE saved;

--
-- Name: audit_org_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_org_time_idx ON public.audit_log USING btree (org_id, created_at DESC);

--
-- Name: book_requests_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_requests_org_idx ON public.book_requests USING btree (org_id, code);

--
-- Name: book_titles_family_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX book_titles_family_idx ON public.book_titles USING btree (org_id, family);

--
-- Name: catalogues_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX catalogues_org_idx ON public.catalogues USING btree (org_id, category);

--
-- Name: contacts_org_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX contacts_org_email_uq ON public.contacts USING btree (org_id, lower(email));

--
-- Name: conv_bcat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_bcat_idx ON public.conversations USING btree (org_id, business_category, last_message_at DESC);

--
-- Name: conv_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_customer_idx ON public.conversations USING btree (customer_id);

--
-- Name: conv_keys_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_keys_conv_idx ON public.conversation_keys USING btree (conversation_id);

--
-- Name: conv_needs_analysis_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_needs_analysis_idx ON public.conversations USING btree (needs_analysis) WHERE needs_analysis;

--
-- Name: conv_norm_subject_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_norm_subject_idx ON public.conversations USING btree (org_id, normalized_subject);

--
-- Name: conv_org_last_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_org_last_idx ON public.conversations USING btree (org_id, last_message_at DESC);

--
-- Name: conv_rag_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_rag_idx ON public.conversations USING btree (org_id, rag);

--
-- Name: conv_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conv_staff_idx ON public.conversations USING gin (staff_participants);

--
-- Name: conversations_org_cat_sub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_org_cat_sub_idx ON public.conversations USING btree (org_id, business_category, subcategory);

--
-- Name: conversations_purposes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_purposes_idx ON public.conversations USING gin (purposes);

--
-- Name: customer_phones_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_phones_customer_idx ON public.customer_phones USING btree (customer_id);

--
-- Name: customer_reviews_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_reviews_open_idx ON public.customer_reviews USING btree (org_id, status);

--
-- Name: customers_buyer_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_buyer_tier_idx ON public.customers USING btree (org_id, buyer_tier);

--
-- Name: customers_domains_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_domains_idx ON public.customers USING gin (domains);

--
-- Name: customers_kalyan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_kalyan_idx ON public.customers USING btree (org_id) WHERE kalyan_buyer;

--
-- Name: customers_name_pin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_name_pin_idx ON public.customers USING btree (org_id, lower(name), ((upload_profile ->> 'pin'::text))) WHERE from_uploads;

--
-- Name: customers_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_org_idx ON public.customers USING btree (org_id);

--
-- Name: customers_profile_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_profile_at_idx ON public.customers USING btree (org_id, profile_at);

--
-- Name: customers_purposes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_purposes_idx ON public.customers USING gin (purposes);

--
-- Name: emails_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_content_idx ON public.emails USING btree (org_id, content_hash);

--
-- Name: emails_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_conv_idx ON public.emails USING btree (conversation_id, sent_at);

--
-- Name: emails_dedup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_dedup_idx ON public.emails USING btree (org_id, dedup_key);

--
-- Name: emails_imid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_imid_idx ON public.emails USING btree (org_id, internet_message_id);

--
-- Name: emails_mailbox_msg_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX emails_mailbox_msg_uq ON public.emails USING btree (mailbox_id, provider_message_id);

--
-- Name: emails_org_sent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emails_org_sent_idx ON public.emails USING btree (org_id, sent_at DESC);

--
-- Name: issues_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX issues_conv_idx ON public.issues USING btree (conversation_id);

--
-- Name: issues_org_cat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX issues_org_cat_idx ON public.issues USING btree (org_id, category, detected_at);

--
-- Name: kalyan_dispatches_batch_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kalyan_dispatches_batch_idx ON public.kalyan_dispatches USING btree (batch_id);

--
-- Name: kalyan_dispatches_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kalyan_dispatches_date_idx ON public.kalyan_dispatches USING btree (org_id, dispdate);

--
-- Name: kalyan_subscribers_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kalyan_subscribers_customer_idx ON public.kalyan_subscribers USING btree (customer_id);

--
-- Name: kalyan_subscribers_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kalyan_subscribers_phone_idx ON public.kalyan_subscribers USING btree (org_id, phone10);

--
-- Name: mailboxes_org_addr_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX mailboxes_org_addr_uq ON public.mailboxes USING btree (org_id, provider, lower(address));

--
-- Name: order_status_history_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_status_history_idx ON public.order_status_history USING btree (org_id, order_key, seen_at);

--
-- Name: orders_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_customer_idx ON public.orders USING btree (customer_id);

--
-- Name: orders_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_date_idx ON public.orders USING btree (org_id, ordered_at DESC);

--
-- Name: orders_mongo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_mongo_idx ON public.orders USING btree (org_id, mongo_id);

--
-- Name: orders_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_phone_idx ON public.orders USING btree (org_id, phone10);

--
-- Name: reference_items_code_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reference_items_code_uq ON public.reference_items USING btree (org_id, kind, code) WHERE (code IS NOT NULL);

--
-- Name: reference_items_org_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reference_items_org_kind_idx ON public.reference_items USING btree (org_id, kind);

--
-- Name: reply_drafts_conv_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reply_drafts_conv_uq ON public.reply_drafts USING btree (conversation_id);

--
-- Name: reply_drafts_org_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reply_drafts_org_status_idx ON public.reply_drafts USING btree (org_id, status, generated_at DESC);

--
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);

--
-- Name: stock_rows_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_rows_code_idx ON public.stock_rows USING btree (org_id, code);

--
-- Name: stock_rows_upload_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_rows_upload_idx ON public.stock_rows USING btree (upload_id, location);

--
-- Name: stock_uploads_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_uploads_org_idx ON public.stock_uploads USING btree (org_id, scope, period_to DESC);

--
-- Name: upload_batches_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX upload_batches_org_idx ON public.upload_batches USING btree (org_id, kind, uploaded_at DESC);

--
-- Name: users_email_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_uq ON public.users USING btree (lower(email));

--
-- Name: users_google_sub_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_google_sub_uq ON public.users USING btree (google_sub) WHERE (google_sub IS NOT NULL);

--
-- Name: action_items action_items_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: action_items action_items_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: action_items action_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: action_items action_items_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: action_items action_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: action_items action_items_source_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_source_email_id_fkey FOREIGN KEY (source_email_id) REFERENCES public.emails(id) ON DELETE SET NULL;

--
-- Name: alert_rules alert_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_rules
    ADD CONSTRAINT alert_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: alerts alerts_acknowledged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: alerts alerts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: alerts alerts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: alerts alerts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: alerts alerts_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.alert_rules(id) ON DELETE SET NULL;

--
-- Name: analytics_runs analytics_runs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_runs
    ADD CONSTRAINT analytics_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: attachments attachments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: attachments attachments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: book_requests book_requests_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: book_requests book_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: book_requests book_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_requests
    ADD CONSTRAINT book_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: book_titles book_titles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_titles
    ADD CONSTRAINT book_titles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: book_titles book_titles_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.book_titles
    ADD CONSTRAINT book_titles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: catalogues catalogues_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogues
    ADD CONSTRAINT catalogues_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: catalogues catalogues_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogues
    ADD CONSTRAINT catalogues_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: contacts contacts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: conversation_keys conversation_keys_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_keys
    ADD CONSTRAINT conversation_keys_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: conversation_notes conversation_notes_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_notes
    ADD CONSTRAINT conversation_notes_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: conversation_notes conversation_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_notes
    ADD CONSTRAINT conversation_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: conversations conversations_assignee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: conversations conversations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: conversations conversations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: customer_health_daily customer_health_daily_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_health_daily
    ADD CONSTRAINT customer_health_daily_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: customer_phones customer_phones_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_phones
    ADD CONSTRAINT customer_phones_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: customer_phones customer_phones_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_phones
    ADD CONSTRAINT customer_phones_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: customer_reviews customer_reviews_customer_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_customer_a_fkey FOREIGN KEY (customer_a) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: customer_reviews customer_reviews_customer_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_customer_b_fkey FOREIGN KEY (customer_b) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: customer_reviews customer_reviews_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: customer_reviews customer_reviews_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_reviews
    ADD CONSTRAINT customer_reviews_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: emails emails_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

--
-- Name: emails emails_duplicate_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_duplicate_of_fkey FOREIGN KEY (duplicate_of) REFERENCES public.emails(id) ON DELETE SET NULL;

--
-- Name: emails emails_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;

--
-- Name: emails emails_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: issues issues_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: issues issues_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: issues issues_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.issues
    ADD CONSTRAINT issues_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: kalyan_dispatches kalyan_dispatches_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_dispatches
    ADD CONSTRAINT kalyan_dispatches_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id) ON DELETE SET NULL;

--
-- Name: kalyan_stage kalyan_stage_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_stage
    ADD CONSTRAINT kalyan_stage_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id) ON DELETE CASCADE;

--
-- Name: kalyan_subscribers kalyan_subscribers_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_subscribers
    ADD CONSTRAINT kalyan_subscribers_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: kalyan_subscribers kalyan_subscribers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kalyan_subscribers
    ADD CONSTRAINT kalyan_subscribers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: mailboxes mailboxes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT mailboxes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: mailboxes mailboxes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailboxes
    ADD CONSTRAINT mailboxes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: oauth_states oauth_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.oauth_states
    ADD CONSTRAINT oauth_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: order_status_history order_status_history_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id) ON DELETE SET NULL;

--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;

--
-- Name: orders orders_first_batch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_first_batch_fkey FOREIGN KEY (first_batch) REFERENCES public.upload_batches(id) ON DELETE SET NULL;

--
-- Name: orders orders_last_batch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_last_batch_fkey FOREIGN KEY (last_batch) REFERENCES public.upload_batches(id) ON DELETE SET NULL;

--
-- Name: orders orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: password_resets password_resets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: purpose_defs purpose_defs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_defs
    ADD CONSTRAINT purpose_defs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: purpose_defs purpose_defs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_defs
    ADD CONSTRAINT purpose_defs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: purpose_retags purpose_retags_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purpose_retags
    ADD CONSTRAINT purpose_retags_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: reference_items reference_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reference_items
    ADD CONSTRAINT reference_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: reply_drafts reply_drafts_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: reply_drafts reply_drafts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: reply_drafts reply_drafts_reply_to_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_reply_to_email_id_fkey FOREIGN KEY (reply_to_email_id) REFERENCES public.emails(id) ON DELETE SET NULL;

--
-- Name: reply_drafts reply_drafts_send_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_send_mailbox_id_fkey FOREIGN KEY (send_mailbox_id) REFERENCES public.mailboxes(id) ON DELETE SET NULL;

--
-- Name: reply_drafts reply_drafts_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: reply_drafts reply_drafts_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_drafts
    ADD CONSTRAINT reply_drafts_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: reply_templates reply_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: reply_templates reply_templates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reply_templates
    ADD CONSTRAINT reply_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: report_runs report_runs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: report_runs report_runs_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.report_schedules(id) ON DELETE SET NULL;

--
-- Name: report_schedules report_schedules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);

--
-- Name: report_schedules report_schedules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_schedules
    ADD CONSTRAINT report_schedules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: stock_files stock_files_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_files
    ADD CONSTRAINT stock_files_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.stock_uploads(id) ON DELETE CASCADE;

--
-- Name: stock_rows stock_rows_upload_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_rows
    ADD CONSTRAINT stock_rows_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.stock_uploads(id) ON DELETE CASCADE;

--
-- Name: stock_uploads stock_uploads_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_uploads
    ADD CONSTRAINT stock_uploads_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: stock_uploads stock_uploads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_uploads
    ADD CONSTRAINT stock_uploads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: stock_uploads stock_uploads_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_uploads
    ADD CONSTRAINT stock_uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: sync_runs sync_runs_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sync_runs
    ADD CONSTRAINT sync_runs_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;

--
-- Name: upload_batches upload_batches_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT upload_batches_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: upload_batches upload_batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT upload_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- Name: upload_batches upload_batches_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_batches
    ADD CONSTRAINT upload_batches_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: upload_file_parts upload_file_parts_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_file_parts
    ADD CONSTRAINT upload_file_parts_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id) ON DELETE CASCADE;

--
-- Name: upload_stage upload_stage_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.upload_stage
    ADD CONSTRAINT upload_stage_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id) ON DELETE CASCADE;

--
-- Name: user_mailboxes user_mailboxes_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mailboxes
    ADD CONSTRAINT user_mailboxes_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.mailboxes(id) ON DELETE CASCADE;

--
-- Name: user_mailboxes user_mailboxes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mailboxes
    ADD CONSTRAINT user_mailboxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--

