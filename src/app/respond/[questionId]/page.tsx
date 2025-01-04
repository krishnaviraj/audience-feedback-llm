import { createClient } from '@supabase/supabase-js';
import ResponseForm from '@/components/ResponseForm/ResponseForm';
import { notFound } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  params: {
    questionId: string;
  };
}

export default async function ResponsePage(props: Props) {
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', props.params.questionId)
    .single();

  if (error || !question) {
    return notFound();
  }

  return <ResponseForm question={question} />;
}