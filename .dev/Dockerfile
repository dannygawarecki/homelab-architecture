# Local preview environment for the GitHub Pages site.
# Uses the real `github-pages` gem so local builds match what GitHub actually runs,
# rather than a newer standalone Jekyll that would hide version differences.
FROM ruby:3.3

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# Copy only the Gemfile first so the (slow) bundle install layer is cached
# and only re-runs when dependencies actually change.
COPY Gemfile ./
RUN bundle install

EXPOSE 4000 35729

# --baseurl '' because locally we serve from the root, not /homelab-architecture.
# --force_polling because filesystem events don't cross the Windows/Linux mount boundary.
# No --incremental: full rebuilds are ~2.5s and avoid incremental's stale-asset bugs
# (including the theme/stylesheet collision that clobbered site.css).
CMD ["bundle", "exec", "jekyll", "serve", \
     "--host", "0.0.0.0", \
     "--baseurl", "", \
     "--livereload", \
     "--force_polling"]
