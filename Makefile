PREFIX = /usr/local
DESTDIR =
HOME-DESTDIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

UUID = home@swsnr.de

DIST-EXTRA-SRC = LICENSE-GPL2 LICENSE-MPL2

.PHONY: format
format:
	yarn format --write

.PHONY: lint
lint:
	yarn lint

.PHONY: check
check: lint
	yarn format --check

.PHONY: fix
fix: format
	yarn lint --fix

.PHONY: compile
compile:
	yarn compile

.PHONY: dist
dist: compile
	mkdir -p ./dist/
	gnome-extensions pack --force --out-dir dist \
		$(addprefix --extra-source=,$(DIST-EXTRA-SRC) $(UIDEFS))

# Make a reproducible dist package
.PHONY: dist-repro
dist-repro: dist
	strip-nondeterminism dist/$(UUID).shell-extension.zip

# Install to local home directory; this simply unpacks the zip file as GNOME would do
.PHONY: install-home
install-home: dist
	mkdir -p $(HOME-DESTDIR)
	bsdtar -xf dist/$(UUID).shell-extension.zip -C $(HOME-DESTDIR) --no-same-owner

.PHONY: uninstall-home
uninstall-home:
	rm -rf $(HOME-DESTDIR)

# Install system wide, moving various parts to appropriate system directories
.PHONY: install-system
install-system: dist
	install -d \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID) \
	bsdtar -xf dist/$(UUID).shell-extension.zip \
		-C $(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID) --no-same-owner

.PHONY: uninstall-system
uninstall-system:
	rm -rf \
		$(DESTDIR)/$(PREFIX)/share/gnome-shell/extensions/$(UUID) \
