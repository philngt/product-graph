# Third-party notices

## Design Studio AI

This slice adapts the paper/ink/accent token vocabulary and DOM keyboard-choice
navigation from **Design Studio AI**, originally by Best Agent Kits contributors.

Reference fork and pinned revision:
https://github.com/philngt/design-studio-ai/tree/740a000ab43deb885681a44805d2d06a1d62b883

Reference paths: `src/styles.css`, `src/app/keyboard-navigation.ts`, and the
`src/shared/diagram-*.ts` family. Adaptations are in `ui/styles.css` and
`ui/studio-controls.js`. `ui/canvas-layout.js` is a separate, dependency-free
implementation inspired by the separation of layout, pins, and semantic data;
it does not contain the upstream Board schema, Dagre engine or obstacle router.
No fonts, images, 3D assets, provider code, or upstream dependencies are bundled.

The upstream license notice follows. This notice does not change the licensing
of unrelated Product Graph code.

MIT License

Copyright (c) 2026 Best Agent Kits contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
