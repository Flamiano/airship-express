import React from 'react';

const nullValueComponent = (
    <span className="text-slate-400 font-normal" > N/A </span>
);

export default function maskPhone(phone: string | null) {
    if (!phone) {
        return nullValueComponent;
    }

    if (phone.length < 4) {
        return '*******';
    }

    return phone.slice(0, 2)
        + '*'.repeat(phone.length - 4)
        + phone.slice(-2);
}

export function maskName(name: string | null) {

    if (!name) {
        return nullValueComponent;
    }

    return name.split(' ').map(word => {

        if (word.length <= 2) {
            return word;
        }

        return word.slice(0, 2) + '*'.repeat(word.length - 2);
    }).join(' ');
}

export function maskEmail(email: string | null) {
    if (!email) {
        return nullValueComponent;
    }

    const [username, domain] = email.split('@');

    if (!username || !domain) {
        return nullValueComponent;
    }

    return username[0] + '*'.repeat(username.length - 1) + '@' + domain
}