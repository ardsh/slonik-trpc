import { type NextPage } from "next";
import Head from "next/head";
import EmployeesTable from "../components/EmployeeTable";

const Home: NextPage = () => {
    return (
        <>
            <Head>
                <title>Create T3 App Slonik-TRPC Example</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className="flex min-h-screen">
                <div className="container flex flex-col justify-center px-4 py-2">
                    <EmployeesTable />
                </div>
            </main>
        </>
    );
};

export default Home;
