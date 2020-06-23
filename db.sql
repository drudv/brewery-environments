CREATE TABLE environment (
   id VARCHAR(100) PRIMARY KEY NOT NULL,
   owner TEXT NOT NULL,
   org_id VARCHAR(20) NOT NULL,
   note TEXT,
   last_changed timestamp without time zone NOT NULL default NOW()
);

CREATE TABLE api_tokens (
   id SERIAL,
   token VARCHAR(100) NOT NULL UNIQUE
);
