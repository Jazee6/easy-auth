import { createStart, CustomFetch } from "@tanstack/react-start";

const globalFetch: CustomFetch = async (url, init) => {
  return fetch(url, init);
};

export const startInstance = createStart(() => {
  return {
    serverFns: {
      fetch: globalFetch,
    },
  };
});
