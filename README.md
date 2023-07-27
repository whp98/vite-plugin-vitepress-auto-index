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
