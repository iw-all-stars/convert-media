////
export async function handler(event: any): Promise<any> {
    try {
        console.info("[START] : ", event.Records[0].s3);
        console.info("[LOG2] : ", event.Records[0].s3.object);
        console.info("[KEY] : ", event.Records[0].s3.object.key);
    } catch (e) {
        console.error("[ERROR] : ", e);
    } 
    return 0;
}