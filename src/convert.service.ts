import { AWSError, MediaConvert, S3 } from "aws-sdk";
import * as sharp from "sharp";
import { S3Event } from "./types";
import { PromiseResult } from "aws-sdk/lib/request";

const TARGET_BUCKET = "challengesem2converted";

const s3 = new S3({
    region: "eu-west-3",
    accessKeyId: process.env.ACCESS_KEY_S3,
    secretAccessKey: process.env.SECRET_KEY_S3,
    signatureVersion: "v4",
});

const mediaConvert = new MediaConvert({
    endpoint: process.env.MEDIA_CONVERT_ENDPOINT,
});

export class ConvertService {
    constructor(private readonly s3Event: S3Event) {}

    async handle(): Promise<void> {
        // Téléchargement de l'objet original depuis S3
        const getObjectParams: AWS.S3.GetObjectRequest = {
            Bucket: this.s3Event.bucket.name,
            Key: this.s3Event.object.key,
        };
        const mediaSource = await s3.getObject(getObjectParams).promise();

        console.log("🟩🟩🟩🟩🟩mediaSource🟩🟩🟩🟩");
        console.log(mediaSource);
        console.log("🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦");

        const isImage = mediaSource.ContentType?.includes("image");

        if (isImage) {
            await this._convertImageToJpg(mediaSource);
        } else {
            await this._convertVideoToMp4(mediaSource);
        }
    }

    private async _convertImageToJpg(
        source: PromiseResult<S3.GetObjectOutput, AWSError>
    ): Promise<void> {
        const convertedImage = await sharp(source.Body as Buffer)
            .jpeg()
            .toBuffer();

        const putObjectParams: AWS.S3.PutObjectRequest = {
            Bucket: TARGET_BUCKET,
            Key: this.s3Event.object.key,
            Body: convertedImage,
        };
        await s3.putObject(putObjectParams).promise();

        console.log(
            `Conversion successfull -> ${TARGET_BUCKET} / ${this.s3Event.object.key}`
        );
        return;
    }

    private async _convertVideoToMp4(
        source: PromiseResult<S3.GetObjectOutput, AWSError>
    ): Promise<void> {
        const {
            Job: { Id: jobId },
        } = await mediaConvert
            .createJob(
                this._getMediaConvertParamsForVideo(this.s3Event.object.key, this.s3Event.object.key)
            )
            .promise();
    }

    private _getMediaConvertParamsForVideo = (
        oldPath: string,
        newPath: string
    ): MediaConvert.Types.CreateJobRequest => ({
        Role: process.env.AWS_MEDIA_CONVERT_ROLE,
        Settings: {
            TimecodeConfig: {
                Source: "ZEROBASED",
            },
            OutputGroups: [
                {
                    CustomName: "OutputGroup",
                    Name: "File Group",
                    Outputs: [
                        {
                            ContainerSettings: {
                                Container: "MP4",
                                Mp4Settings: {},
                            },
                            VideoDescription: {
                                CodecSettings: {
                                    Codec: "H_264",
                                    H264Settings: {
                                        MaxBitrate: 5000000,
                                        RateControlMode: "QVBR",
                                        SceneChangeDetect:
                                            "TRANSITION_DETECTION",
                                    },
                                },
                            },
                            AudioDescriptions: [
                                {
                                    CodecSettings: {
                                        Codec: "AAC",
                                        AacSettings: {
                                            Bitrate: 96000,
                                            CodingMode: "CODING_MODE_2_0",
                                            SampleRate: 48000,
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                    OutputGroupSettings: {
                        Type: "FILE_GROUP_SETTINGS",
                        FileGroupSettings: {
                            Destination: `s3://${TARGET_BUCKET}/${newPath}`,
                            DestinationSettings: {
                                S3Settings: {
                                    AccessControl: {
                                        CannedAcl: "PUBLIC_READ",
                                    },
                                },
                            },
                        },
                    },
                },
            ],
            Inputs: [
                {
                    FileInput: `s3://${this.s3Event.bucket.name}/${oldPath}`,
                    TimecodeSource: "ZEROBASED",
                    VideoSelector: {},
                    AudioSelectors: {
                        "Audio Selector 1": {
                            DefaultSelection: "DEFAULT",
                        },
                    },
                },
            ],
        },
        AccelerationSettings: {
            Mode: "DISABLED",
        },
        StatusUpdateInterval: "SECONDS_60",
        Priority: 0,
        HopDestinations: [],
    });
}
