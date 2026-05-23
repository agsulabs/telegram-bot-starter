export type ConnectedChat = {
    id: number;
    type: string;
    title: string | null;
    username: string | null;
    status: string;
    connectedAt: Date;
    updatedAt: Date;
};
