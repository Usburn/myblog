
create table if not exists membre (
    id_membre serial primary key,
    nom varchar(35) not null,
    prenom varchar(30) not null,
    email varchar(35) not null,
    password text not null,
    is_admin integer default 0
);
create table if not exists post (
    id_post serial primary key,
    titre text not null,
    accroche text,
    type text,
    id_admin integer,
    date_post timestamp default current_timestamp,
    foreign key (id_admin)
        references membre(id_membre)
        on delete cascade
);
create table if not exists paragraph (
    id_paragraph serial primary key,
    contenu_p text,
    date_creation_p timestamp default current_timestamp,
    position_p integer,
    id_post integer,
    foreign key (id_post)
        references post(id_post)
        on delete cascade
);
create table if not exists file (
    id_file serial primary key,
    contenu_f text,
    position_f integer,
    date_creation_f timestamp default current_timestamp,
    id_post integer,
    foreign key (id_post)
        references post(id_post)
        on delete cascade
);



