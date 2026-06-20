import React from 'react';
import Layout from '@theme/Layout';

export default function Home() {
  return (
    <Layout title="Home" description="Project documentation">
      <main style={{ padding: '2rem' }}>
        <h1>{{stackLabel}} Project</h1>
        <p>Documentation site scaffolded by Dev Harness.</p>
      </main>
    </Layout>
  );
}
