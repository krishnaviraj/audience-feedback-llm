// App Router Types
export type PageProps<Params = {}> = {
    params: Params;
    searchParams?: { [key: string]: string | string[] | undefined };
  };
  
  export type DashboardPageProps = PageProps<{
    questionId: string;
  }>;