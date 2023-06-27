import { useAuthorize, useSession } from "@blitzjs/auth";
import { BlitzPage } from "@blitzjs/next";
import { usePaginatedQuery } from "@blitzjs/rpc";
import { Backdrop, CircularProgress, Pagination } from "@mui/material";
import { useRouter } from "next/router";
import { Suspense } from "react";
import Dashboard2 from "src/core/components/Dashboard2";
import { useCurrentUser } from "src/users/hooks/useCurrentUser";
import getUsers from "src/users/queries/getUsers";

const ITEMS_PER_PAGE = 4;

const Inner = () => {
    useAuthorize();
    const currentUser = useCurrentUser();
    const session = useSession();
    const router = useRouter();
    const page = Number(router.query.page) || 0;
    const [{ users, hasMore, count }] = usePaginatedQuery(getUsers, {
        orderBy: { id: "asc" },
        skip: ITEMS_PER_PAGE * page,
        take: ITEMS_PER_PAGE,
    });
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    // const goToPreviousPage = () => router.push({ query: { page: page - 1 } });
    // const goToNextPage = () => router.push({ query: { page: page + 1 } });

    const onPaginationChange = (event: React.ChangeEvent<unknown>, value: number) => {
        router.push({ query: { page: value } })
    };

    return (<>
        <div>{currentUser ? currentUser.role : "non."}</div>
        <div>{JSON.stringify(session)}</div>
        <Pagination count={totalPages} page={page} onChange={onPaginationChange} />
    </>
    );
};

const UserListPage: BlitzPage = () => {

    return (
        <Suspense fallback="loading">
            <Dashboard2>
                <Inner></Inner>
            </Dashboard2>
        </Suspense>
    );
};

export default UserListPage;
