let token: string | null = null;

export const setSessionToken = (t: string | null) => {
  token = t;
};

export const getSessionToken = () => token;
