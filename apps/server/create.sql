create table "user"
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    email      varchar                                            not null
        unique,
    password   varchar,
    avatar     varchar,
    created_at timestamp with time zone default now()             not null,
    nickname   varchar                                            not null,
    scope      varchar
);

create table account
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    uid        uuid                                               not null
        references "user",
    provider   varchar                                            not null,
    created_at timestamp with time zone default now()             not null,
    name       varchar                                            not null,
    ouid       varchar                                            not null
);

create table app
(
    id           varchar                                not null
        primary key,
    created_at   timestamp with time zone default now() not null,
    name         varchar,
    public_key   json                                   not null,
    private_key  json                                   not null,
    redirect_uri varchar                                not null,
    secret       varchar                                not null
);

create table code
(
    id         uuid                     default gen_random_uuid() not null
        primary key,
    "user"     json                                               not null,
    created_at timestamp with time zone default now()             not null
);
