# Publishing the separate repository

The implementation is a separate local Git repository. The authenticated GitHub
connection rejected creation of `nullmonori-sopp/Kremen-Learn` with
`Resource not accessible by integration (createRepository)`. This is a service
permission limitation; no remote creation or successful push is claimed.

After enabling repository-creation permission, run from the project root:

```sh
gh repo create nullmonori-sopp/Kremen-Learn --public --source=. --remote=origin --push
```

If the remote was created separately and is empty:

```sh
git remote add origin https://github.com/nullmonori-sopp/Kremen-Learn.git
git push -u origin main
```

Review an existing remote before pushing. Installers are ignored in Git and can
be attached separately to a release together with checksums. The source archive
contains the pinned compiler source, application, curriculum and bilingual docs;
it does not contain build caches or user progress.
