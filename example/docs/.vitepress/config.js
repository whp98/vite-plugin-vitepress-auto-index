import AutoIndex from "vite-plugin-vitepress-auto-index";

export default {
  lang: "en-US",
  title: "VitePress",
  description: "Vite & Vue powered static site generator.",
  vite: {
    plugins: [AutoIndex({})],
  },
  themeConfig: {
     nav: [{ text: "home", link: "/" },{ text: "note", link: "/note/index" }],
  },
};
