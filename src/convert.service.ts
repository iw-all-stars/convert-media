import { AWSError, MediaConvert, S3 } from "aws-sdk";
import * as sharp from "sharp";
import { S3Event } from "./types";
import { PromiseResult } from "aws-sdk/lib/request";

const s3 = new S3();
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

        console.log('🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩')
        console.log(mediaSource)
        console.log('🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦')

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
        try {
            const convertedImage = await sharp(source.Body as Buffer)
                .jpeg()
                .toBuffer();

            const targetBucket = "challengesem2converted"; // Remplacez par votre bucket de destination
            const targetKey = `${this.s3Event.object.key}.jpg`;
            const putObjectParams: AWS.S3.PutObjectRequest = {
                Bucket: targetBucket,
                Key: targetKey,
                Body: convertedImage,
            };
            await s3.putObject(putObjectParams).promise();

            console.log(
                `Conversion réussie : ${this.s3Event.object.key} converti en ${targetKey}`
            );
            return;
        } catch (error) {
            console.error("Erreur lors de la conversion :", error);
            throw error;
        }
    }

    private async _convertVideoToMp4(
        source: PromiseResult<S3.GetObjectOutput, AWSError>
    ): Promise<void> {
        const {
            Job: { Id: jobId },
        } = await mediaConvert
            .createJob(
                this._getMediaConvertParamsForVideo("oldPath", "newPath")
            )
            .promise();
    }

    private _getMediaConvertParamsForVideo = (
        oldPath: string,
        newPath: string
    ): MediaConvert.Types.CreateJobRequest => ({
        Role:
            process.env.AWS_MEDIA_CONVERT_ROLE,
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
                            Destination: `s3://${process.env.AWS_BUCKET}/${newPath}`,
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
                    FileInput: `s3://${process.env.AWS_BUCKET}/${oldPath}`,
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
