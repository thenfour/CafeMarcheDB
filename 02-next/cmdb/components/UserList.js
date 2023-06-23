import { useForm } from 'react-hook-form';

export default UserList = ({ users }) => {
    return <ul>{ users.map(u => <li>{u.firstName}</li>)}</ul>;
};

