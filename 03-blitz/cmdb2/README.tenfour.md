<pre>


based on the blitz tutorial; created using the CLI
npm install <google passport stuff>
blitz install material-ui
.env.local file edited

</pre>

# tech & rationale

  * blitz-js: because it seems to provide the full-stack dev in a single place (raw react/express won't without hacking like 7jam), conventional, targets specifically things like dashboards (otoh Next.js loves to demonstrate simple blogs). So if i go with learning next.js, i would be learning the mechanics of next which blitz lets me ignore, while having to reinvent many of the wheels that blitz provides.
  * do NOT use react-admin; it has too many limitations and you end up customizing everything. it's literally easier to just build your own based off MUI
  * material-ui because it's conventional and the datagrid has everything i need
  * google-oauth via passport
  * prisma ORM - default
  * tailwind css + emotion engine because it's the default, though i don't really use its features

# how: change db schema

  1. modify `schema.prisma`
  1. `blitz prisma db push`       // for intermediate prototyping
  1. `blitz prisma migrate dev --name <migration_name>` for committing schema change to be run in prod

# how: reset db and start fresh



# how: deployment?

