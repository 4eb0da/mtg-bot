export function processUserName(user: string) {
    return user.startsWith('@') ? user.substring(1) : user;
}
