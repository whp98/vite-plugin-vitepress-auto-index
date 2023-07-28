# vite-plugin-vitepress-auto-index

vitepress 插件自动建立索引文件

## ✨ Feature

自动生成index.md文件

## 🕯️ Usage

install vite-plugin-vitepress-auto-index

```bash
yarn add vite-plugin-vitepress-auto-index
```

add plugin in `.vitepress/config.ts`

```typescript
import AutoIndex from 'vite-plugin-vitepress-auto-index';

export default defineConfig({
  vite: {
    plugins: [
      {
        ...AutoIndex({}),
        enforce: 'pre'
      },
    ]
  },
})
```

## blog file formate
1. formate1
```text
folder
 - doc1.md
 - doc2.md
```
auto generate index.md
```text
folder
 - doc1.md
 - doc2.md
 - index.md
```

or 
```text
folder
 - doc1.md
 - doc2(folder)
```
auto generate index.md
```text
folder
 - doc1.md
 - doc2(folder)
 - index.md
```


2. formate2

```text
title(folder)
 - title.md
 - asset.jpg
```
if not other md file in a folder and have asset md title must
*same* name with the folder, otherwise your file will be remove into a
xxxx.time.del.bak file.

if there is an index.md file here it also will be *removed* 
into a xxxx.time.del.bak file.
