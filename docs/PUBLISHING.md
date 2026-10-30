# Publishing

[Русский](PUBLISHING.ru.md) · [Development](DEVELOPMENT.md)

Kremen Learn lives in a separate repository from the language compiler. The
compiler source is vendored at the commit recorded in `toolchain.lock.json`.
Build caches, installers and local user data do not belong in Git.

## Create the remote

From the project root, with a GitHub account that can create repositories:

```sh
gh repo create nullmonori-sopp/Kremen-Learn --public --source=. --remote=origin --push \
  --description 'An offline desktop studio for learning Kremen: lessons, a code editor and a real local compiler. Free and open source.'
```

If the repository already exists, inspect its contents before configuring the
remote. For an empty repository owned by the intended account:

```sh
git remote add origin https://github.com/nullmonori-sopp/Kremen-Learn.git
git push -u origin main
```

An integration may allow reading and pushing without allowing repository
creation. A `Resource not accessible by integration` response requires changing
that connection's permissions or having the owner create an empty repository.
It does not mean a repository was created.

## Prepare a release

1. Follow [development and packaging](DEVELOPMENT.md), including the real native
   tests with `--include-ignored`.
2. Run the installer and application on each claimed platform. Record the
   environment, test evidence and gaps in [verification](VERIFICATION.md).
3. Update the changelog and version identifiers together. Review the repository
   for user data, credentials, caches and unsupported claims.
4. Publish the installers separately from source, with SHA-256 checksums and
   release notes that name the verified distribution and system prerequisites.
   Keep source and package commit identities clear.

The supplied workflow builds Linux packages and uploads workflow artifacts.
It does not automatically create a release or claim Windows coverage. A source
archive should include application code, lessons, bilingual documentation and
the pinned compiler source, without build caches or user databases.
