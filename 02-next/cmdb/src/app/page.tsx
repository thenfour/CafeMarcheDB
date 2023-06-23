
import db from "../../db/models/index";
import UserList from "../../components/UserList"

export default async function Home({users}) {

  return (
    <main>
      {typeof users}
    </main>
  )
}

export const getServerSideProps = async () => {
  console.log("begingetServerSideProps()");
  const users = await db.User.findAll();
  return {
    props: {
      initialContacts: users,
    }
  }
}

