//
export async function handler(event: any): Promise<any> {
    try {
        console.info("[START] : ", event);
    } catch (e) {
        console.error("[ERROR] : ", e);
    } 
    return 0;
}