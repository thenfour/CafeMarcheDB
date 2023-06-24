<pre>


based on the blitz tutorial; created using the CLI
npm install <google passport stuff>
blitz install material-ui
.env.local file edited
npm install react-admin
npm install --save @theapexlab/ra-data-blitz

</pre>

# tech & rationale

  * blitz-js: because it seems to provide the full-stack dev in a single place (raw react/express won't without hacking like 7jam), conventional, targets specifically things like dashboards (otoh Next.js loves to demonstrate simple blogs). So if i go with learning next.js, i would be learning the mechanics of next which blitz lets me ignore, while having to reinvent many of the wheels that blitz provides.
  * react-admin, obvious reasons. i don't see an alternative that's as specifically targetted as this.
  * material-ui because react-admin depends on it.
  * google-oauth / passport
  * prisma ORM - default
  * tailwind css because it's the default
