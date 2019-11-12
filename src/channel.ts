interface Channel {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    team_id: string;
    type: string;
    display_name: string;
    name: string;
    header: string;
    purpose: string;
    last_post_at: number;
    total_msg_count: number;
    extra_update_at: number;
    creator_id: string;
    scheme_id?: any; // check correct type
    props?: any; // check correct type
    group_constrained?: any; // check correct type
}
