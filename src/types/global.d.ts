export {};

declare global {
   interface Window {
      api: {
         getLogs: () => Promise<any[] | undefined>;
         setLogs: (logs: any[]) => Promise<void>;
      };
   }
}
