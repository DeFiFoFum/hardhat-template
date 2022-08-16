import 'dotenv/config'

export function getEnv(name: string, required = false): string {
    const value = process.env[name];
    if(!value) {
        const message = `${getEnv.name}:: Environment variable ${name} not found.`
        if(required) {
            throw new Error(message);
        }
        console.log(message);
        return '';
    } else {
        return value;
    }
}