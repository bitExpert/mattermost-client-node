interface IPost {
    id: string;
    create_at: number;
    update_at: number;
    edit_at: number;
    delete_at: number;
    is_pinned: boolean;
    user_id: string;
    channel_id: string;
    root_id: string;
    parent_id: string;
    original_id: string;
    message: string;
    type: string;
    props: object;
    hashtags: string;
    pending_post_id: string;
    metadata: object;
}
