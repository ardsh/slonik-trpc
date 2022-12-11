import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Easy to Use',
    description: (
      <>
        Very easy to get started, without sacrificing on efficiency or flexibility.
        Secure by default and easily extensible for advanced use cases.
      </>
    ),
  },
  {
    title: 'Declarative',
    description: (
      <>
        <code>slonik-tRPC</code> lets you focus on displaying your data.
        Declare your filters and fields with zod types, and it does the job of composing them into efficient, type-safe queries, accessible through a simple API.
      </>
    ),
  },
  {
    title: 'Powered by Slonik & Zod',
    description: (
      <>
        For ultimate type-safety and composability. Unleash the power of PostgreSQL with Slonik-tRPC and Zod.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      {/* <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div> */}
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
