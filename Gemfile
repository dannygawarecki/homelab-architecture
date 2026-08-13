source "https://rubygems.org"

gem "github-pages", group: :jekyll_plugins

group :jekyll_plugins do
  gem "jekyll-sitemap"
  gem "jekyll-seo-tag"
end

gem "webrick", "~> 1.8"

# Local-only. Jekyll builds happily with broken internal links; this catches them.
group :development do
  gem "html-proofer", "~> 5.0"
end
